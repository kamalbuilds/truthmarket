# { "Depends": "py-genlayer:latest" }
from genlayer import *
from datetime import datetime

genvm_eth = gl.evm


class CryptoPredictionMarket(gl.Contract):
    market_id: str
    token_symbol: str
    token_name: str
    market_title: str
    side_a: str
    side_b: str
    resolved_price: u256
    winning_side: str
    resolution_url: str
    resolved_at: str
    # Bridge config
    bridge_sender: Address
    target_chain_eid: u256
    target_contract: str

    def __init__(self, market_id: str, token_symbol: str, token_name: str, market_title: str, side_a: str, side_b: str,
                 bridge_sender: str, target_chain_eid: int, target_contract: str):
        if not market_id or not token_symbol or not token_name or not market_title or not side_a or not side_b:
            raise gl.vm.UserError("All parameters are required: market_id, token_symbol, token_name, market_title, side_a, side_b")
        if not bridge_sender or not target_contract:
            raise gl.vm.UserError("Bridge config required: bridge_sender, target_chain_eid, target_contract")

        # Store bridge config
        self.bridge_sender = Address(bridge_sender)
        self.target_chain_eid = u256(target_chain_eid)
        self.target_contract = target_contract

        self.market_id = market_id
        self.token_symbol = token_symbol.upper()
        self.token_name = token_name
        self.market_title = market_title
        self.side_a = side_a
        self.side_b = side_b

        # Build URL from token name
        url = f"https://coinmarketcap.com/currencies/{token_name.lower()}/"
        self.resolution_url = url
        self.resolved_at = gl.message_raw['datetime']

        # Resolve price and determine winning side at deployment time
        def fetch_price_and_winner_task():
            content = gl.nondet.web.render(url, mode="text")

            # Use local variables to avoid storage access in nondet context
            prompt = f"""
            IMPORTANT: This contract is being deployed at the resolution time mentioned in the market title.
            Any future time reference in the title refers to NOW - we have reached that target date/time.

            Market: {market_title}
            Side A: {side_a}
            Side B: {side_b}

            Based on this website content about {token_name} ({token_symbol.upper()}):
            {content[:1500]}

            Extract the current price in USD and determine which side won based on the market conditions described in the title.
            Remember: if the title mentions a future date/time, that time is NOW.

            Return your response as a valid JSON object with this exact structure:
            {{"price": 65000.50, "winner": "{side_a}"}}

            Where price is the numeric value only and winner must be EXACTLY one of these options:
            - "{side_a}"
            - "{side_b}"

            Do not use "Side A" or "Side B" - use the exact text provided above.
            """
            return gl.nondet.exec_prompt(prompt)

        # All validators must agree on the exact result
        json_result = gl.eq_principle.strict_eq(fetch_price_and_winner_task)

        # Parse JSON response (strip markdown code blocks if present)
        import json
        import re
        clean_result = re.sub(r'^```(?:json)?\s*|\s*```$', '', json_result.strip())
        result_data = json.loads(clean_result)

        # Extract price and winner from JSON
        price_value = result_data["price"]
        winner_value = result_data["winner"]

        # Convert price to cents and store
        self.resolved_price = u256(int(price_value * 100))
        self.winning_side = winner_value

        # Send resolution to EVM via bridge
        self._send_resolution_to_bridge()

    def _send_resolution_to_bridge(self):
        """Encode and send resolution result to EVM via BridgeSender."""
        # Determine if side_a won
        side_a_wins = (self.winning_side == self.side_a)
        is_undetermined = False
        timestamp = int(datetime.now().timestamp())
        tx_hash = bytes(32)  # Empty hash placeholder

        # Step 1: Encode resolution data: (address, bool, bool, uint256, bytes32, uint256, string)
        resolution_abi = [Address, bool, bool, u256, bytes, u256, str]
        resolution_encoder = genvm_eth.MethodEncoder("", resolution_abi, bool)
        resolution_data = resolution_encoder.encode_call([
            Address(self.market_id),  # bet address
            side_a_wins,
            is_undetermined,
            u256(timestamp),
            tx_hash,
            self.resolved_price,      # price value (in cents)
            self.winning_side         # winning side name
        ])[4:]  # Remove method selector

        # Step 2: Wrap with target contract address: (address, bytes)
        # BetFactoryCOFI.processBridgeMessage expects: (address targetContract, bytes data)
        wrapper_abi = [Address, bytes]
        wrapper_encoder = genvm_eth.MethodEncoder("", wrapper_abi, bool)
        message_bytes = wrapper_encoder.encode_call([
            Address(self.market_id),  # targetContract (the bet address)
            resolution_data           # the resolution data
        ])[4:]  # Remove method selector

        # Send via BridgeSender
        bridge = gl.get_contract_at(self.bridge_sender)
        bridge.emit().send_message(
            self.target_chain_eid,
            self.target_contract,
            message_bytes
        )

    @gl.public.view
    def get_resolution_details(self) -> dict:
        return {
            "market_id": self.market_id,
            "market_title": self.market_title,
            "token_symbol": self.token_symbol,
            "token_name": self.token_name,
            "side_a": self.side_a,
            "side_b": self.side_b,
            "resolved_price_cents": int(self.resolved_price),
            "winning_side": self.winning_side,
            "resolution_url": self.resolution_url,
            "resolved_at": self.resolved_at
        }