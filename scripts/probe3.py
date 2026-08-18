# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *


class Probe3(gl.Contract):
    result: str
    vm_api: str

    def __init__(self):
        self.result = ""
        self.vm_api = ",".join(a for a in dir(gl.vm) if not a.startswith("_"))

    @gl.public.write
    def run(self, url: str) -> None:
        def block():
            page = gl.nondet.web.render(url, mode="text")
            snippet = page[:3000]
            prompt = (
                "Read this web page text and answer strictly as JSON.\n"
                "Fields: {\"title\": str, \"sells_digital_file\": bool, \"confidence\": int}\n"
                "Output ONLY JSON.\n\nPAGE:\n" + snippet
            )
            raw = gl.nondet.exec_prompt(prompt)
            raw = raw.replace("```json", "").replace("```", "").strip()
            data = json.loads(raw)
            return json.dumps(data, sort_keys=True)

        self.result = gl.eq_principle.prompt_comparative(
            block,
            principle="Both outputs must agree on sells_digital_file exactly; title may be worded differently; confidence may differ by up to 25.",
        )

    @gl.public.view
    def get(self) -> str:
        return self.result

    @gl.public.view
    def vm(self) -> str:
        return self.vm_api
