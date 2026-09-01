import UnityPy, os, json, traceback, collections
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
from UnityPy.helpers.TypeTreeNode import TypeTreeNode

ROOT="/home/agent/gamedev/race-star-mtj729op/teardown"
W=os.path.join(ROOT,"work","Data")
OUT=os.path.join(ROOT,"work","configs"); os.makedirs(OUT, exist_ok=True)

g=TypeTreeGenerator("6000.0.62f1")
g.load_il2cpp(open(f"{ROOT}/raw/x/arm/lib/armeabi-v7a/libil2cpp.so","rb").read(),
              open(f"{ROOT}/raw/x/base/assets/bin/Data/Managed/Metadata/global-metadata.dat","rb").read())
print("il2cpp loaded", flush=True)

tt_cache={}
def nodes(asm, ns, cls):
    key=(asm,ns,cls)
    if key in tt_cache: return tt_cache[key]
    full=f"{ns}.{cls}" if ns else cls
    try: n=TypeTreeNode.from_list(g.get_nodes(asm, full))
    except Exception as e: n=None
    tt_cache[key]=n
    return n

def jsonable(v):
    if isinstance(v,dict): return {k:jsonable(x) for k,x in v.items()}
    if isinstance(v,(list,tuple)): return [jsonable(x) for x in v]
    if isinstance(v,(int,float,str,bool)) or v is None: return v
    return str(v)

stats=collections.Counter(); dumped=collections.Counter()
files=sorted(f for f in os.listdir(W) if os.path.isfile(os.path.join(W,f)))
for fi,f in enumerate(files):
    try: env=UnityPy.load(os.path.join(W,f))
    except Exception: continue
    for o in env.objects:
        if o.type.name!="MonoBehaviour": continue
        try: mb=o.read(check_read=False)
        except Exception: stats["read_fail"]+=1; continue
        script=getattr(mb,"m_Script",None)
        if script is None: stats["no_script"]+=1; continue
        try: ms=script.read()
        except Exception: stats["script_deref_fail"]+=1; continue
        asm=(getattr(ms,"m_AssemblyName","") or "").replace(".dll","")
        ns=getattr(ms,"m_Namespace","") or ""
        cls=getattr(ms,"m_ClassName","") or ""
        if not asm.startswith(("Features.","Core.","Backend.","_Game")): continue
        if not any(k in cls for k in ("Config","Data","Balance","Settings")): continue
        n=nodes(asm,ns,cls)
        if not n: stats["no_tree:"+cls]+=1; continue
        try: tree=o.read_typetree(n)
        except Exception: stats["tt_fail:"+cls]+=1; continue
        name=tree.get("m_Name") or f"{cls}_{o.path_id}"
        safe="".join(c if c.isalnum() or c in "._-" else "_" for c in f"{cls}__{name}")
        with open(os.path.join(OUT,safe+".json"),"w") as fh:
            json.dump(jsonable(tree), fh, ensure_ascii=False, indent=1)
        dumped[cls]+=1
    if fi%200==0: print("...",fi,"/",len(files),"dumped",sum(dumped.values()), flush=True)

print("DUMPED", sum(dumped.values()))
for k,v in dumped.most_common(): print(f"  {v:5d} {k}")
print("ISSUES", dict(stats.most_common(20)))
