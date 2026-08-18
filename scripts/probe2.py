# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import inspect
from genlayer import *


class Probe2(gl.Contract):
    def __init__(self):
        pass

    @gl.public.view
    def sigs(self) -> str:
        out = []
        targets = {
            "web.render": gl.nondet.web.render,
            "web.get": gl.nondet.web.get,
            "exec_prompt": gl.nondet.exec_prompt,
            "strict_eq": gl.eq_principle.strict_eq,
            "prompt_comparative": gl.eq_principle.prompt_comparative,
            "prompt_non_comparative": gl.eq_principle.prompt_non_comparative,
        }
        for name, fn in targets.items():
            try:
                out.append(f"{name}{inspect.signature(fn)}")
            except Exception as e:
                out.append(f"{name}: ERR {e}")
        out.append("MESSAGE_ATTRS: " + ",".join(
            a for a in dir(gl.message) if not a.startswith("_")))
        out.append("GL_TOP: " + ",".join(a for a in dir(gl) if not a.startswith("_")))
        return "\n".join(out)
