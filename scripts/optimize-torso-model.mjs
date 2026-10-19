// Verkleinert das Torso-Modell der Injektionskarte fuer Handys.
//
// Quelle:  assets-src/models/torso_hybrid_v1.glb  (17,7 MB, ~223 MB Grafikspeicher)
// Ziel:    public/models/torso_hybrid_v1.web.glb
//
// - Texturen: Farbe + Normalen 4096 -> 2048, Metallic/Roughness 2048 -> 1024, als WebP.
// - Emissive-Textur faellt weg: prepareInjectionTorsoModel setzt die Staerke ohnehin auf 0.
// - Geometrie: Meshopt-Kompression mit Quantisierung. Die Dreiecke bleiben dieselben,
//   gespeicherte Pins (model_version 'placeholder-v1') liegen weiter auf der Haut.
//   Meshopt statt Draco, weil drei den Meshopt-Decoder mitbringt; Draco laedt seinen
//   Decoder von einem fremden CDN.
//
// Abhaengigkeiten werden nur hierfuer gebraucht, nicht im Build:
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
//   npm run model:optimize
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const SOURCE = 'assets-src/models/torso_hybrid_v1.glb'
const TARGET = 'public/models/torso_hybrid_v1.web.glb'

await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const document = await io.read(SOURCE)

for (const material of document.getRoot().listMaterials()) {
  material.setEmissiveTexture(null)
}

await document.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|normal)Texture$/, resize: [2048, 2048], quality: 88 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^metallicRoughnessTexture$/, resize: [1024, 1024], quality: 85 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
)

await io.write(TARGET, document)
console.log(`geschrieben: ${TARGET}`)
