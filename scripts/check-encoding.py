from pathlib import Path
import subprocess


changed = subprocess.check_output(
    ["git", "diff", "--name-only", "--cached"],
    text=True,
    encoding="utf-8",
).splitlines()

bad = []
markers = [
    "\ufffd",
    "\u00d0",
    "\u00d1",
    "\u0420\u045f",
    "\u00e2\u20ac",
    "\u00e2\u20ac\u2122",
    "\u00e2\u20ac\u0153",
    "\u00e2\u20ac\x9d",
]

for name in changed:
    path = Path(name)
    if not path.exists() or path.is_dir():
        continue
    try:
        data = path.read_bytes()
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        bad.append(f"{name}: not valid UTF-8")
        continue
    if any(marker in text for marker in markers):
        bad.append(f"{name}: possible mojibake/broken encoding marker")

if bad:
    print("\n".join(bad))
    raise SystemExit(1)

print("Encoding check passed")
