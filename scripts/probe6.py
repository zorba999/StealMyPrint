# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import inspect
from genlayer import *


class Probe6(gl.Contract):
    report: str

    def __init__(self):
        lines = []
        proxy = gl.get_contract_at(
            Address("0x0000000000000000000000000000000000000001")
        )
        lines.append("PROXY: " + ",".join(a for a in dir(proxy) if not a.startswith("_")))
        for name in ("emit", "view", "emit_transfer", "send"):
            fn = getattr(proxy, name, None)
            if fn is None:
                continue
            try:
                lines.append(f"PROXY.{name}{inspect.signature(fn)}")
            except Exception as e:
                lines.append(f"PROXY.{name}: sig? {e}")
        lines.append("VM: " + ",".join(a for a in dir(gl.vm) if not a.startswith("_")))
        lines.append("CONTRACT_IFACE: " + ",".join(
            a for a in dir(gl.contract_interface) if not a.startswith("_")))
        lines.append("BALANCE_ATTR: " + ",".join(
            a for a in dir(gl.message) if not a.startswith("_")))
        for extra in ("balance", "get_balance", "transfer", "send_value"):
            lines.append(f"gl.{extra}: {hasattr(gl, extra)}")
        self.report = "\n".join(lines)

    @gl.public.view
    def get(self) -> str:
        return self.report
