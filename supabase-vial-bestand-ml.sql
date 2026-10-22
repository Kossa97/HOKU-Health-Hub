-- Vial mit fertiger Loesung: Bestand in ml wird abgebucht
--
-- Ein Vial, dessen Bestand nicht in Vials, sondern z. B. in ml gefuehrt wird
-- (Testosteron Enantat 250 mg/ml, Packung 10 ml), fiel in
-- apply_inventory_confirmation in den alten Vial-Weg. Der rechnet mit den
-- Altspalten stack_items.vial_amount_mg / vials_in_stock, die bei neuen
-- Eintraegen leer sind, und bricht mit „Vial stock conversion is ambiguous"
-- ab — eine bestaetigte Einnahme buchte nichts ab.
--
-- Jetzt nimmt ein solches Vial den allgemeinen Weg (Umrechnung ueber die
-- Zutat, Buchung in stack_item_inventory_movements). reverse_inventory_
-- confirmation erstattet diese Buchungen schon heute unabhaengig von der
-- Form; sie bleibt unveraendert.
--
-- Nur die Funktion wird ersetzt; keine Tabelle, keine Zeile wird geaendert.
-- Zweimal ausfuehrbar; der zweite Lauf aendert nichts.

begin;

create or replace function public.apply_inventory_confirmation(p_dose_log_id uuid)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  log public.dose_logs;
  item public.stack_items;
  inventory_row public.stack_item_inventory;
  has_inventory boolean;
  uses_vial_inventory boolean;
  uses_generic_inventory boolean;
  movement public.stack_item_inventory_movements;
  vial_movement public.vial_stock_movements;
  ingredient_count integer;
  convertible_count integer;
  minimum_delta numeric;
  maximum_delta numeric;
  actual_delta numeric;
  vial_delta numeric;
  actual_vial_delta numeric;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into log
  from public.dose_logs
  where id = p_dose_log_id
    and user_id = owner_id
    and taken is true
  for update;

  if not found then
    raise exception 'Confirmed dose log not found';
  end if;

  select *
  into item
  from public.stack_items
  where id = log.stack_item_id
    and user_id = owner_id
  for update;

  if not found then
    raise exception 'Stack item not found';
  end if;

  select *
  into inventory_row
  from public.stack_item_inventory
  where stack_item_id = item.id
    and user_id = owner_id
  for update;
  has_inventory := found;
  -- Ein Vial bucht ueber den Bestand, sobald es einen in Vials gefuehrten hat
  -- (und die Umrechnung eindeutig ist, siehe vial_uses_inventory). Wie der
  -- alte Weg unabhaengig von der Erfassungstiefe.
  uses_vial_inventory := has_inventory and public.vial_uses_inventory(item.id);
  -- Ein Vial mit fertiger Loesung (Testosteron, 250 mg/ml) fuehrt seinen
  -- Bestand in ml, nicht in Vials. Es bucht ueber den allgemeinen Weg — die
  -- Umrechnung ueber die Zutat (mg -> ml) ist dort dieselbe wie bei jeder
  -- anderen Form. Vorher fiel es in den alten Vial-Weg, der mit leeren
  -- Altspalten (vial_amount_mg) rechnete und mit „conversion ambiguous"
  -- abbrach: abgebucht wurde nichts.
  -- Gibt es zu dieser Einnahme schon eine alte Vial-Buchung, bleibt es beim
  -- alten Weg — sonst stuenden zwei Buchungen fuer eine Einnahme.
  uses_generic_inventory := item.dosage_form = 'vial'
    and has_inventory
    and inventory_row.enabled
    and inventory_row.package_unit is not null
    and inventory_row.package_unit <> 'vial'
    and not exists (
      select 1
      from public.vial_stock_movements existing
      where existing.source_dose_log_id = p_dose_log_id
        and existing.user_id = owner_id
    );

  -- Alle anderen Vials: der alte Weg, unveraendert.
  if item.dosage_form = 'vial' and not uses_vial_inventory and not uses_generic_inventory then
    select *
    into vial_movement
    from public.vial_stock_movements
    where source_dose_log_id = p_dose_log_id
      and user_id = owner_id
    for update;

    if found then
      if vial_movement.applied then
        return item.vials_in_stock;
      end if;

      actual_vial_delta := least(coalesce(item.vials_in_stock, 0), vial_movement.delta_vials);

      update public.stack_items
      set vials_in_stock = round(greatest(0, coalesce(vials_in_stock, 0) - actual_vial_delta), 4)
      where id = item.id
        and user_id = owner_id
      returning vials_in_stock into item.vials_in_stock;

      update public.vial_stock_movements
      set
        dose_log_id = p_dose_log_id,
        delta_vials = actual_vial_delta,
        applied = true
      where id = vial_movement.id
        and user_id = owner_id;

      return item.vials_in_stock;
    end if;

    if log.dose is null or log.unit is null or log.dose <= 0 then
      raise exception 'Vial stock conversion is ambiguous or unsupported';
    end if;

    if lower(log.unit) = 'ml' then
      if item.reconstitution_ml is null or item.reconstitution_ml <= 0 then
        raise exception 'Vial stock conversion is ambiguous or unsupported';
      end if;
      vial_delta := log.dose / item.reconstitution_ml;
    elsif lower(log.unit) in ('mg', 'mcg') then
      if item.vial_amount_mg is null or item.vial_amount_mg <= 0 then
        raise exception 'Vial stock conversion is ambiguous or unsupported';
      end if;
      vial_delta := case
        when lower(log.unit) = 'mcg' then log.dose / 1000
        else log.dose
      end / item.vial_amount_mg;
    else
      raise exception 'Vial stock conversion is ambiguous or unsupported';
    end if;

    if not (vial_delta > 0 and vial_delta <= '1000000000'::numeric) then
      raise exception 'Vial stock conversion is ambiguous or unsupported';
    end if;

    actual_vial_delta := least(coalesce(item.vials_in_stock, 0), vial_delta);

    insert into public.vial_stock_movements (
      user_id,
      stack_item_id,
      dose_log_id,
      source_dose_log_id,
      delta_vials,
      applied
    ) values (
      owner_id,
      item.id,
      p_dose_log_id,
      p_dose_log_id,
      actual_vial_delta,
      true
    );

    update public.stack_items
    set vials_in_stock = round(greatest(0, coalesce(vials_in_stock, 0) - actual_vial_delta), 4)
    where id = item.id
      and user_id = owner_id
    returning vials_in_stock into item.vials_in_stock;

    return item.vials_in_stock;
  end if;

  if item.tracking_level <> 'complete' and not uses_vial_inventory then
    return null;
  end if;

  if not has_inventory then
    return null;
  end if;
  if not inventory_row.enabled then
    return inventory_row.remaining_quantity;
  end if;

  -- Vor der Umstellung gebucht, danach rueckgaengig gemacht und jetzt erneut
  -- bestaetigt: die alte Buchung wird wiederverwendet, jetzt auf den Bestand.
  if uses_vial_inventory then
    select *
    into vial_movement
    from public.vial_stock_movements
    where source_dose_log_id = p_dose_log_id
      and user_id = owner_id
    for update;

    if found then
      if vial_movement.applied then
        return inventory_row.remaining_quantity;
      end if;

      actual_vial_delta := least(inventory_row.remaining_quantity, vial_movement.delta_vials);

      update public.stack_item_inventory
      set
        remaining_quantity = round(remaining_quantity - actual_vial_delta, 4),
        updated_at = now()
      where id = inventory_row.id
        and user_id = owner_id
      returning remaining_quantity into inventory_row.remaining_quantity;

      update public.vial_stock_movements
      set
        dose_log_id = p_dose_log_id,
        delta_vials = actual_vial_delta,
        applied = true
      where id = vial_movement.id
        and user_id = owner_id;

      return inventory_row.remaining_quantity;
    end if;
  end if;

  select *
  into movement
  from public.stack_item_inventory_movements
  where source_dose_log_id = p_dose_log_id
    and user_id = owner_id
  for update;

  if found then
    if movement.applied then
      return inventory_row.remaining_quantity;
    end if;
    if uses_vial_inventory then
      -- Wie beim ersten Buchen: ein leeres Vial lehnt nicht ab, es bucht
      -- hoechstens den Rest.
      actual_delta := least(inventory_row.remaining_quantity, movement.delta_quantity);
      if actual_delta <= 0 then
        return inventory_row.remaining_quantity;
      end if;
    else
      if inventory_row.remaining_quantity < movement.delta_quantity then
        raise exception 'Insufficient inventory for confirmation';
      end if;
      actual_delta := movement.delta_quantity;
    end if;

    update public.stack_item_inventory
    set
      remaining_quantity = remaining_quantity - actual_delta,
      updated_at = now()
    where id = inventory_row.id
      and user_id = owner_id
    returning remaining_quantity into inventory_row.remaining_quantity;

    update public.stack_item_inventory_movements
    set
      dose_log_id = p_dose_log_id,
      delta_quantity = actual_delta,
      applied = true
    where id = movement.id
      and user_id = owner_id;

    return inventory_row.remaining_quantity;
  end if;

  if log.dose is null
    or log.unit is null
    or log.dose <= 0
    or log.dose > '1000000000'::numeric then
    raise exception 'Inventory conversion is ambiguous or unsupported';
  end if;

  with ingredient_deltas as (
    select case
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = ingredient.basis_unit
        then log.dose
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = ingredient.amount_unit
        then log.dose / ingredient.amount_value * ingredient.basis_value
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = 'mg' and ingredient.amount_unit = 'mcg'
        then log.dose * 1000 / ingredient.amount_value * ingredient.basis_value
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = 'mcg' and ingredient.amount_unit = 'mg'
        then log.dose / 1000 / ingredient.amount_value * ingredient.basis_value
      -- Aufgezogene Milliliter aus einem angemischten Vial: ein Vial haelt
      -- genau die zugefuegte Fluessigkeit.
      when ingredient.basis_unit = inventory_row.package_unit
        and inventory_row.package_unit = 'vial'
        and lower(log.unit) = 'ml'
        and inventory_row.reconstitution_ml > 0
        then log.dose / inventory_row.reconstitution_ml
    end as delta
    from public.stack_item_ingredients ingredient
    where ingredient.stack_item_id = item.id
  )
  select count(*), count(delta), min(delta), max(delta)
  into ingredient_count, convertible_count, minimum_delta, maximum_delta
  from ingredient_deltas;

  if ingredient_count = 0
    or convertible_count <> ingredient_count
    or minimum_delta is null
    or minimum_delta <= 0
    or maximum_delta > '1000000000'::numeric
    or minimum_delta is distinct from maximum_delta then
    raise exception 'Inventory conversion is ambiguous or unsupported';
  end if;

  if uses_vial_inventory then
    -- Vials rechnen wie bisher auf vier Stellen und lassen eine Einnahme
    -- aus leerem Bestand zu, statt sie abzulehnen.
    actual_delta := least(inventory_row.remaining_quantity, round(minimum_delta, 4));
    if actual_delta <= 0 then
      return inventory_row.remaining_quantity;
    end if;
  else
    actual_delta := least(inventory_row.remaining_quantity, minimum_delta);
    if actual_delta <= 0 then
      raise exception 'Insufficient inventory for confirmation';
    end if;
  end if;

  insert into public.stack_item_inventory_movements (
    user_id,
    inventory_id,
    dose_log_id,
    source_dose_log_id,
    delta_quantity,
    applied
  ) values (
    owner_id,
    inventory_row.id,
    p_dose_log_id,
    p_dose_log_id,
    actual_delta,
    true
  );

  update public.stack_item_inventory
  set
    remaining_quantity = remaining_quantity - actual_delta,
    updated_at = now()
  where id = inventory_row.id
    and user_id = owner_id
  returning remaining_quantity into inventory_row.remaining_quantity;

  return inventory_row.remaining_quantity;
end;
$$;

commit;
