"""ソース・実測結果・一次資料を、秘密・依存物を含めずZIPにまとめる。"""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[1]
excluded={'.git','node_modules','dist','__pycache__','.vercel'}
files=[p for p in root.rglob('*') if p.is_file() and not any(x in excluded for x in p.relative_to(root).parts) and not p.name.startswith('.env') and p.name not in {'SOURCE-MANIFEST.json'}]
manifest={'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]}
m=root/'SOURCE-MANIFEST.json';m.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');files.append(m)
with ZipFile(root.parent/'shift-kensan-source.zip','w',ZIP_DEFLATED) as z:
 for p in sorted(files):z.write(p,Path(root.name)/p.relative_to(root))
print(f'{len(files)} files: {root.parent / "shift-kensan-source.zip"}')
