import re, os, sys, glob
repos = {
 "TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03": "/tmp/hg",
 "TorqueNados-FRC5090/Robot-Template/blob/b8dddd0e338841e867c0cc260162e6097adecd7b": "/tmp/rt",
 "HALFxAxHEART/frc-auto-align/blob/c95ddf4a2ee25c406ea6e2ed04e232b17b39b8f7": "/tmp/faa",
 "TorqueNados-FRC5090/Stingray-2025/blob/97c843705075c729538ad0b3925f67a35e3bf791": "/tmp/Stingray-2025",
 "TorqueNados-FRC5090/Petrichor-2023/blob/f8931338bb4aa79e3dd94a0dab2027ead4281bdb": "/tmp/Petrichor-2023",
 "TorqueNados-FRC5090/Thunderstrike-2024/blob/876b8c14682ccf57ec0ab2767ee2da54c34cee6e": "/tmp/Thunderstrike-2024",
}
bad = 0; total = 0
gdir = sys.argv[1]
names = set(os.listdir(gdir))
for f in sorted(glob.glob(gdir + "/*.md")):
    txt = open(f).read()
    for m in re.finditer(r"https://github\.com/([^\s)\]#]+?)(?:#L(\d+)(?:-L(\d+))?)?(?=[\s)\]>])", txt):
        url, a, b = m.group(1), m.group(2), m.group(3)
        for k, local in repos.items():
            if url.startswith(k + "/"):
                total += 1
                path = os.path.join(local, url[len(k)+1:])
                if not os.path.exists(path):
                    print(f"{os.path.basename(f)}: MISSING {url}"); bad += 1; break
                if a:
                    n = sum(1 for _ in open(path, errors="ignore"))
                    if int(b or a) > n or int(a) < 1:
                        print(f"{os.path.basename(f)}: RANGE {url}#L{a}-{b} (file has {n})"); bad += 1
                break
        else:
            if "/blob/" in url and any(r.split('/blob/')[0] in url for r in repos):
                print(f"{os.path.basename(f)}: UNPINNED {url}")
    for m in re.finditer(r"\]\((\d\d-[^)#]+\.md)", txt):
        if m.group(1) not in names:
            print(f"{os.path.basename(f)}: BAD LOCAL LINK {m.group(1)}"); bad += 1
print(f"{total} permalinks, {bad} problems")
