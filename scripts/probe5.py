# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *


class Probe5(gl.Contract):
    result: str

    def __init__(self):
        self.result = ""

    @gl.public.write
    def probe(self, url: str, mode: str) -> None:
        def block():
            try:
                page = gl.nondet.web.render(url, mode=mode)
                return json.dumps({"u": url[:60], "ok": True, "len": len(page), "head": page[:200]})
            except Exception as e:
                return json.dumps({"u": url[:60], "ok": False, "err": str(e)[:260]})

        self.result = gl.eq_principle.prompt_non_comparative(
            block,
            task="Return the input JSON string unchanged.",
            criteria="The output must be the same JSON that was given as input.",
        )

    @gl.public.view
    def get(self) -> str:
        return self.result
