import UnityPy, os, collections, json, sys
W="/home/agent/gamedev/race-star-mtj729op/teardown/work/Data"
OUT="/home/agent/gamedev/race-star-mtj729op/teardown/work/textassets"
os.makedirs(OUT, exist_ok=True)
total=collections.Counter(); n=0; saved=0
files=sorted(f for f in os.listdir(W) if not f.endswith(('.split','.json','.config','.dat')) )
for f in files:
    p=os.path.join(W,f)
    if os.path.isdir(p): continue
    try: env=UnityPy.load(p)
    except Exception: continue
    for o in env.objects:
        total[o.type.name]+=1
        if o.type.name=="TextAsset":
            try:
                d=o.read()
                name=getattr(d,'m_Name',None) or f"unnamed_{saved}"
                script=getattr(d,'m_Script',None)
                if script is None: continue
                raw = script.encode('utf-8','surrogateescape') if isinstance(script,str) else bytes(script)
                safe="".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)
                open(os.path.join(OUT, f"{safe}.txt"),'wb').write(raw)
                saved+=1
            except Exception as e:
                pass
    n+=1
    if n%200==0: print("...",n,"files, TextAssets saved:",saved, flush=True)
print("FILES:",n)
print("SAVED TextAssets:",saved)
print(json.dumps(dict(total.most_common(40)), indent=1))
