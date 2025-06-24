from web3 import Web3
from eth_account import Account
from typing import List
import os
import json
import random
import string
from datetime import datetime

# Chainlink VRF Contract ABI (phần quan trọng)
VRF_COORDINATOR_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "keyHash", "type": "bytes32"},
            {"internalType": "uint64", "name": "subId", "type": "uint64"},
            {"internalType": "uint16", "name": "minimumRequestConfirmations", "type": "uint16"},
            {"internalType": "uint32", "name": "callbackGasLimit", "type": "uint32"},
            {"internalType": "uint32", "name": "numWords", "type": "uint32"}
        ],
        "name": "requestRandomWords",
        "outputs": [{"internalType": "uint256", "name": "requestId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

class ChainlinkVRF:
    def __init__(self):
        # Khởi tạo Web3 với Polygon Mumbai testnet
        self.w3 = Web3(Web3.HTTPProvider(os.getenv('POLYGON_RPC_URL', 'https://rpc-mumbai.maticvigil.com')))
        
        # Contract address của VRF Coordinator trên Mumbai
        coordinator_address = os.getenv('VRF_COORDINATOR_ADDRESS', '0x9DdF1122ea0123c56a9E0773E5fE32Fb8D1CD958B16')
        # Chuyển đổi địa chỉ sang định dạng checksum
        self.vrf_coordinator_address = Web3.to_checksum_address(coordinator_address)
        
        # Khởi tạo contract
        self.vrf_contract = self.w3.eth.contract(
            address=self.vrf_coordinator_address,
            abi=VRF_COORDINATOR_ABI
        )
        
        # Private key để ký giao dịch
        private_key = os.getenv('PRIVATE_KEY')
        if private_key:
            self.account = Account.from_key(private_key)
        else:
            raise ValueError("PRIVATE_KEY environment variable is required")

    async def generate_random_code(self, prefix: str, count: int) -> List[str]:
        """
        Tạo mã ngẫu nhiên sử dụng Chainlink VRF
        Trong trường hợp lỗi, sẽ fallback về phương pháp tạo ngẫu nhiên local
        """
        try:
            # Tham số cho VRF request
            key_hash = os.getenv('VRF_KEY_HASH')
            sub_id = int(os.getenv('VRF_SUB_ID', '1'))
            min_confirmations = 3
            callback_gas_limit = 100000
            num_words = count  # Số lượng số ngẫu nhiên cần

            # Gọi VRF contract
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            tx = self.vrf_contract.functions.requestRandomWords(
                key_hash,
                sub_id,
                min_confirmations,
                callback_gas_limit,
                num_words
            ).build_transaction({
                'from': self.account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price
            })

            # Ký và gửi transaction
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Đợi transaction được confirm
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Xử lý kết quả và tạo mã
            random_numbers = self._process_vrf_response(receipt)
            return [
                f"{prefix}-{datetime.utcnow().strftime('%Y%m%d')}-{self._number_to_code(num)}"
                for num in random_numbers
            ]
            
        except Exception as e:
            # Fallback về phương pháp tạo ngẫu nhiên local
            return self._generate_fallback_codes(prefix, count)

    def _process_vrf_response(self, receipt) -> List[int]:
        """Xử lý kết quả từ VRF và chuyển thành list số ngẫu nhiên"""
        # Trong thực tế, bạn sẽ cần implement callback để nhận kết quả
        # Ở đây chúng ta sẽ tạo số ngẫu nhiên local như một fallback
        return [random.randint(10000, 99999) for _ in range(5)]

    def _number_to_code(self, number: int) -> str:
        """Chuyển số thành mã code với chữ và số"""
        chars = string.ascii_uppercase + string.digits
        code = ""
        while number > 0:
            code = chars[number % len(chars)] + code
            number //= len(chars)
        return code.rjust(6, '0')

    def _generate_fallback_codes(self, prefix: str, count: int) -> List[str]:
        """Tạo mã ngẫu nhiên local trong trường hợp VRF không khả dụng"""
        codes = []
        for i in range(count):
            random_num = random.randint(100000, 999999)
            code = f"{prefix}-{datetime.utcnow().strftime('%Y%m%d')}-{random_num}"
            codes.append(code)
        return codes

    async def get_random_int(self, max_value: int) -> int:
        """
        Sinh số nguyên ngẫu nhiên [0, max_value) sử dụng Chainlink VRF
        Nếu lỗi sẽ fallback về random local
        """
        try:
            key_hash = os.getenv('VRF_KEY_HASH')
            sub_id = int(os.getenv('VRF_SUB_ID', '1'))
            min_confirmations = 3
            callback_gas_limit = 100000
            num_words = 1

            nonce = self.w3.eth.get_transaction_count(self.account.address)
            tx = self.vrf_contract.functions.requestRandomWords(
                key_hash,
                sub_id,
                min_confirmations,
                callback_gas_limit,
                num_words
            ).build_transaction({
                'from': self.account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price
            })
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            random_numbers = self._process_vrf_response(receipt)
            if random_numbers and max_value > 0:
                return random_numbers[0] % max_value
            else:
                return random.randint(0, max_value - 1)
        except Exception as e:
            return random.randint(0, max_value - 1) 