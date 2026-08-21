# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


class Probe7(gl.Contract):
    note: str

    def __init__(self):
        self.note = ""

    @gl.public.write.payable
    def deposit(self) -> None:
        self.note = "in:" + str(int(gl.message.value))

    @gl.public.write
    def send_finalized(self, to: str, amount: int) -> None:
        gl.get_contract_at(Address(to)).emit_transfer(value=u256(amount))
        self.note = "sent finalized"

    @gl.public.write
    def send_accepted(self, to: str, amount: int) -> None:
        gl.get_contract_at(Address(to)).emit_transfer(
            value=u256(amount), on="accepted"
        )
        self.note = "sent accepted"

    @gl.public.view
    def get(self) -> str:
        return self.note
