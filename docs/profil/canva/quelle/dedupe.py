# Gleiche Bilder in der pptx nur einmal ablegen (pptxgenjs legt jede Verwendung neu ab)
import sys, zipfile, hashlib, re
src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
files = {n: z.read(n) for n in z.namelist()}
canon, drop = {}, {}
for n in sorted(f for f in files if f.startswith('ppt/media/')):
    h = hashlib.md5(files[n]).hexdigest()
    if h in canon: drop[n] = canon[h]
    else: canon[h] = n
for n in list(files):
    if n.endswith('.rels'):
        s = files[n].decode()
        for d, c in drop.items():
            s = s.replace('../media/' + d.split('/')[-1] + '"', '../media/' + c.split('/')[-1] + '"')
        files[n] = s.encode()
for d in drop: del files[d]
ct = files['[Content_Types].xml'].decode()
for d in drop: ct = re.sub(r'<Override PartName="/%s"[^>]*/>' % re.escape(d), '', ct)
files['[Content_Types].xml'] = ct.encode()
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as o:
    for n in z.namelist():
        if n in files: o.writestr(n, files[n])
print('entfernt', len(drop), 'doppelte Bilder')
