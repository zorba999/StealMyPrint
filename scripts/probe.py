# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


class Probe(gl.Contract):
    note: str

    def __init__(self):
        self.note = "init"

    @gl.public.view
    def api_report(self) -> str:
        found = []
        for path in [
            "gl.nondet.web.render",
            "gl.nondet.web.get",
            "gl.nondet.exec_prompt",
            "gl.eq_principle.strict_eq",
            "gl.eq_principle.prompt_comparative",
            "gl.eq_principle.prompt_non_comparative",
            "gl.get_webpage",
            "gl.exec_prompt",
            "gl.eq_principle_strict_eq",
            "gl.eq_principle_prompt_comparative",
            "gl.eq_principle_prompt_non_comparative",
            "gl.advanced.run_nondet",
            "gl.message.sender_address",
            "gl.advanced.sandbox",
        ]:
            obj = gl
            ok = True
            for part in path.split(".")[1:]:
                if hasattr(obj, part):
                    obj = getattr(obj, part)
                else:
                    ok = False
                    break
            if ok:
                found.append(path)
        return " | ".join(found)
