import UnityPy, os, json, collections
W="Data"
out={}
for f in sorted(os.listdir(W)):
    p=os.path.join(W,f)
    if os.path.isdir(p): continue
    try: env=UnityPy.load(p)
    except Exception: continue
    for o in env.objects:
        if o.type.name!="MonoScript": continue
        try: d=o.read_typetree()
        except Exception: continue
        key=(d.get("m_AssemblyName",""), d.get("m_Namespace",""), d.get("m_ClassName",""))
        out[str(o.path_id)+"@"+f]=key
json.dump({k:list(v) for k,v in out.items()}, open("monoscripts.json","w"), indent=0)
asm=collections.Counter(v[0] for v in out.values())
print("MonoScripts:", len(out))
print(asm.most_common(15))
names=sorted(set((v[0],v[1],v[2]) for v in out.values()))
cfg=[n for n in names if "Config" in n[2]]
print("Config classes:", len(cfg))
for n in cfg[:40]: print("  ", n)
