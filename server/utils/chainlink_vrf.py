from web3 import AsyncWeb3, AsyncHTTPProvider
from eth_account import Account
from typing import List, Dict, Optional
import os
import json
import random
import string
from datetime import datetime
import asyncio
from collections import deque
import threading
import time

# Thay thế bằng ABI của hợp đồng SubscriptionConsumer của bạn
# Bạn có thể lấy nó từ Remix sau khi biên dịch hợp đồng
# Ví dụ: Mở file .json ABI của hợp đồng đã biên dịch
# Ví dụ này chỉ bao gồm các hàm cần thiết, bạn nên dùng ABI đầy đủ
VRF_CONSUMER_ABI = [
	{
		"inputs": [],
		"name": "acceptOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "subscriptionId",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "have",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "want",
				"type": "address"
			}
		],
		"name": "OnlyCoordinatorCanFulfill",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "have",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "coordinator",
				"type": "address"
			}
		],
		"name": "OnlyOwnerOrCoordinator",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			},
			{
				"internalType": "uint256[]",
				"name": "randomWords",
				"type": "uint256[]"
			}
		],
		"name": "rawFulfillRandomWords",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "ZeroAddress",
		"type": "error"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": False,
				"internalType": "address",
				"name": "vrfCoordinator",
				"type": "address"
			}
		],
		"name": "CoordinatorSet",
		"type": "event"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": True,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": True,
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "OwnershipTransferRequested",
		"type": "event"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": True,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": True,
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": False,
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			},
			{
				"indexed": False,
				"internalType": "uint256[]",
				"name": "randomWords",
				"type": "uint256[]"
			}
		],
		"name": "RequestFulfilled",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "bool",
				"name": "enableNativePayment",
				"type": "bool"
			}
		],
		"name": "requestRandomWords",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": False,
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			},
			{
				"indexed": False,
				"internalType": "uint32",
				"name": "numWords",
				"type": "uint32"
			}
		],
		"name": "RequestSent",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_vrfCoordinator",
				"type": "address"
			}
		],
		"name": "setCoordinator",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "callbackGasLimit",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_requestId",
				"type": "uint256"
			}
		],
		"name": "getRequestStatus",
		"outputs": [
			{
				"internalType": "bool",
				"name": "fulfilled",
				"type": "bool"
			},
			{
				"internalType": "uint256[]",
				"name": "randomWords",
				"type": "uint256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "keyHash",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "lastRequestId",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "numWords",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "requestConfirmations",
		"outputs": [
			{
				"internalType": "uint16",
				"name": "",
				"type": "uint16"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "requestIds",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "s_requests",
		"outputs": [
			{
				"internalType": "bool",
				"name": "fulfilled",
				"type": "bool"
			},
			{
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "s_subscriptionId",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "s_vrfCoordinator",
		"outputs": [
			{
				"internalType": "contract IVRFCoordinatorV2Plus",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]

class VRFBatchManager:
    """
    Quản lý batch VRF requests để tối ưu hiệu suất và giảm chi phí gas
    """
    def __init__(self, vrf_instance: 'ChainlinkVRF', batch_size: int = 50, cache_size: int = 200):
        self.vrf_instance = vrf_instance
        self.batch_size = batch_size
        self.cache_size = cache_size
        self.cached_numbers = deque(maxlen=cache_size)
        self.pending_requests = []
        self.is_processing = False
        self.lock = threading.Lock()
        self.last_request_time = 0
        self.min_interval = 2  # Tối thiểu 2 giây giữa các batch requests
        self.is_prewarmed = False  # Flag để kiểm tra đã pre-warm chưa
        self.prewarm_task = None  # Task pre-warming
        
    async def prewarm_cache(self, initial_size: int = 100):
        """
        Pre-warm cache với số lượng số ngẫu nhiên ban đầu
        """
        if self.is_prewarmed:
            print("[VRF Pre-warm] Cache already pre-warmed")
            return
        self.is_prewarmed = True  # Đặt flag NGAY LẬP TỨC để tránh lặp
        print(f"[VRF Pre-warm] Starting pre-warm with {initial_size} numbers...")
        try:
            # Thêm timeout cho batch VRF
            import asyncio
            try:
                initial_numbers = await asyncio.wait_for(self._get_batch_vrf_numbers(initial_size), timeout=30)
            except asyncio.TimeoutError:
                print("[VRF Pre-warm] Timeout when pre-warming VRF, fallback to local random")
                initial_numbers = [random.randint(0, 2**32 - 1) for _ in range(initial_size)]
            with self.lock:
                for num in initial_numbers:
                    if len(self.cached_numbers) < self.cache_size:
                        self.cached_numbers.append(num)
            print(f"[VRF Pre-warm] Successfully pre-warmed cache with {len(initial_numbers)} numbers")
        except Exception as e:
            print(f"[VRF Pre-warm] Error during pre-warm: {e}")
            # Fallback: fill cache với local random
            with self.lock:
                for _ in range(min(initial_size, self.cache_size)):
                    if len(self.cached_numbers) < self.cache_size:
                        self.cached_numbers.append(random.randint(0, 2**32 - 1))
            print(f"[VRF Pre-warm] Fallback: filled cache with {len(self.cached_numbers)} local random numbers")
    
    async def start_background_prewarm(self):
        """
        Bắt đầu pre-warming trong background
        """
        if self.prewarm_task is None:
            self.prewarm_task = asyncio.create_task(self._background_prewarm())
            print("[VRF Pre-warm] Background pre-warming started")
    
    async def _background_prewarm(self):
        """
        Background task để pre-warm cache
        """
        try:
            # Pre-warm ban đầu
            await self.prewarm_cache(100)
            
            # Tiếp tục pre-warm định kỳ
            while True:
                await asyncio.sleep(60)  # Pre-warm mỗi phút
                
                # Kiểm tra cache level
                with self.lock:
                    cache_level = len(self.cached_numbers) / self.cache_size
                
                if cache_level < 0.3:  # Nếu cache dưới 30%
                    print(f"[VRF Pre-warm] Cache low ({cache_level:.1%}), refilling...")
                    await self._refill_cache(50)
                    
        except Exception as e:
            print(f"[VRF Pre-warm] Background pre-warm error: {e}")
    
    async def _refill_cache(self, count: int):
        """
        Refill cache với số lượng mới
        """
        try:
            new_numbers = await self._get_batch_vrf_numbers(count)
            
            with self.lock:
                for num in new_numbers:
                    if len(self.cached_numbers) < self.cache_size:
                        self.cached_numbers.append(num)
            
            print(f"[VRF Pre-warm] Refilled cache with {len(new_numbers)} numbers")
            
        except Exception as e:
            print(f"[VRF Pre-warm] Error refilling cache: {e}")
    
    async def get_random_int(self, max_value: int) -> int:
        """
        Lấy số ngẫu nhiên từ cache hoặc tạo batch request mới
        """
        # Kiểm tra cache trước
        if self.cached_numbers:
            with self.lock:
                if self.cached_numbers:
                    number = self.cached_numbers.popleft()
                    return number % max_value if max_value > 0 else 0
        
        # Nếu cache hết và chưa pre-warm, thực hiện pre-warm nhanh
        if not self.is_prewarmed:
            print("[VRF] Cache empty and not pre-warmed, performing quick pre-warm...")
            await self.prewarm_cache(20)  # Quick pre-warm với 20 số
            
            # Thử lấy từ cache sau khi pre-warm
            with self.lock:
                if self.cached_numbers:
                    number = self.cached_numbers.popleft()
                    return number % max_value if max_value > 0 else 0
        
        # Nếu cache vẫn hết, thêm vào pending requests
        future = asyncio.Future()
        with self.lock:
            self.pending_requests.append({
                'max_value': max_value,
                'future': future
            })
        
        # Trigger batch processing nếu cần
        await self._trigger_batch_processing()
        
        # Chờ kết quả
        result = await future
        return result
    
    async def _trigger_batch_processing(self):
        """
        Trigger batch processing nếu đủ điều kiện
        """
        current_time = time.time()
        
        with self.lock:
            # Kiểm tra điều kiện để tạo batch mới
            should_process = (
                len(self.pending_requests) >= self.batch_size or
                (len(self.pending_requests) > 0 and 
                 current_time - self.last_request_time >= self.min_interval and
                 not self.is_processing)
            )
            
            if should_process and not self.is_processing:
                self.is_processing = True
                requests_to_process = self.pending_requests.copy()
                self.pending_requests.clear()
        
        if should_process:
            # Xử lý batch trong background
            asyncio.create_task(self._process_batch(requests_to_process))
    
    async def _process_batch(self, requests: List[Dict]):
        """
        Xử lý batch VRF requests
        """
        try:
            print(f"[VRF Batch] Processing {len(requests)} requests...")
            
            # Tạo batch request với số lượng lớn hơn để có đủ cho cache
            total_needed = len(requests) + self.batch_size
            batch_numbers = await self._get_batch_vrf_numbers(total_needed)
            
            # Phân phối kết quả cho các requests
            for i, request in enumerate(requests):
                if i < len(batch_numbers):
                    result = batch_numbers[i] % request['max_value'] if request['max_value'] > 0 else 0
                    request['future'].set_result(result)
                else:
                    # Fallback nếu không đủ số
                    result = random.randint(0, request['max_value'] - 1) if request['max_value'] > 0 else 0
                    request['future'].set_result(result)
            
            # Thêm số còn lại vào cache
            remaining_numbers = batch_numbers[len(requests):]
            with self.lock:
                for num in remaining_numbers:
                    if len(self.cached_numbers) < self.cache_size:
                        self.cached_numbers.append(num)
            
            print(f"[VRF Batch] Completed. Added {len(remaining_numbers)} numbers to cache")
            
        except Exception as e:
            print(f"[VRF Batch] Error processing batch: {e}")
            # Fallback cho tất cả requests
            for request in requests:
                try:
                    result = random.randint(0, request['max_value'] - 1) if request['max_value'] > 0 else 0
                    request['future'].set_result(result)
                except:
                    request['future'].set_exception(Exception("VRF batch processing failed"))
        finally:
            with self.lock:
                self.is_processing = False
                self.last_request_time = time.time()
    
    async def _get_batch_vrf_numbers(self, count: int) -> List[int]:
        """
        Lấy batch VRF numbers từ smart contract
        """
        try:
            # Sử dụng VRF để lấy nhiều số ngẫu nhiên
            # Có thể cần điều chỉnh smart contract để hỗ trợ batch
            numbers = []
            for _ in range(min(count, 10)):  # Giới hạn 10 requests mỗi lần để tránh timeout
                number = await self.vrf_instance.get_direct_vrf(2**32 - 1)
                numbers.append(number)
            
            # Nếu cần nhiều hơn, tạo thêm bằng cách hash
            while len(numbers) < count:
                if numbers:
                    # Sử dụng hash của số trước để tạo số mới
                    new_number = hash(str(numbers[-1]) + str(time.time())) % (2**32 - 1)
                    numbers.append(new_number)
                else:
                    numbers.append(random.randint(0, 2**32 - 1))
            
            return numbers[:count]
            
        except Exception as e:
            print(f"[VRF Batch] Error getting batch numbers: {e}")
            # Fallback to local random
            return [random.randint(0, 2**32 - 1) for _ in range(count)]

class ChainlinkVRF:
    def __init__(self):
        # Thay đổi 2: Sử dụng AsyncHTTPProvider
        self.w3 = AsyncWeb3(AsyncHTTPProvider(os.getenv('AVALANCHE_FUJI_RPC_URL', 'https://avalanche-fuji-c-chain-rpc.publicnode.com')))
        
        consumer_contract_address = os.getenv('VRF_CONSUMER_CONTRACT_ADDRESS')
        if not consumer_contract_address:
            raise ValueError("VRF_CONSUMER_CONTRACT_ADDRESS environment variable is required")
        
        self.consumer_contract_address = AsyncWeb3.to_checksum_address(consumer_contract_address)
        
        self.consumer_contract = self.w3.eth.contract(
            address=self.consumer_contract_address,
            abi=VRF_CONSUMER_ABI
        )
        
        private_key = os.getenv('PRIVATE_KEY')
        if private_key:
            self.account = Account.from_key(private_key)
        else:
            raise ValueError("PRIVATE_KEY environment variable is required")
        
        # Khởi tạo batch manager
        self.batch_manager = VRFBatchManager(self)
        
        # Tự động start pre-warming trong background
        self._start_prewarm_async()
    
    def _start_prewarm_async(self):
        """
        Start pre-warming trong background thread
        """
        def start_prewarm():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(self.batch_manager.start_background_prewarm())
            except Exception as e:
                print(f"[VRF] Error starting pre-warm: {e}")
        
        # Start trong background thread
        import threading
        prewarm_thread = threading.Thread(target=start_prewarm, daemon=True)
        prewarm_thread.start()
        print("[VRF] Pre-warming started in background thread")

    async def generate_random_code(self, prefix: str, count: int) -> List[str]:
        try:
            # Sử dụng batch manager để tối ưu hiệu suất
            random_numbers = []
            for _ in range(count):
                number = await self.batch_manager.get_random_int(2**32 - 1)
                random_numbers.append(number)

            if random_numbers:
                return [
                    f"{prefix}-{datetime.utcnow().strftime('%Y%m%d')}-{self._number_to_code(num)}"
                    for num in random_numbers
                ]
            else:
                return self._generate_fallback_codes(prefix, count)
            
        except Exception as e:
            print(f"Lỗi khi yêu cầu VRF: {e}")
            return self._generate_fallback_codes(prefix, count)

    async def _wait_for_random_words(self, request_id: int, timeout: int = 300) -> List[int]:
        start_time = datetime.now()
        while (datetime.now() - start_time).total_seconds() < timeout:
            try:
                # Thay đổi 4: Thêm 'await' cho lời gọi contract
                fulfilled, random_words = await self.consumer_contract.functions.getRequestStatus(request_id).call()
                if fulfilled:
                    print(f"Đã nhận được số ngẫu nhiên cho Request ID {request_id}: {random_words}")
                    return random_words
                else:
                    print(f"Chờ số ngẫu nhiên cho Request ID {request_id}...")
                    await asyncio.sleep(5)
            except Exception as e:
                print(f"Lỗi khi kiểm tra trạng thái yêu cầu {request_id}: {e}")
                await asyncio.sleep(5)
        print(f"Hết thời gian chờ nhận số ngẫu nhiên cho Request ID {request_id}.")
        return []

    def _number_to_code(self, number: int) -> str:
        chars = string.ascii_uppercase + string.digits
        code = ""
        base = len(chars)
        if number == 0:
            return '0' * 6
        
        while number > 0:
            code = chars[number % base] + code
            number //= base
        return code.rjust(6, '0')

    def _generate_fallback_codes(self, prefix: str, count: int) -> List[str]:
        print("Sử dụng fallback tạo mã ngẫu nhiên local.")
        codes = []
        for i in range(count):
            random_num = random.randint(100000, 999999)
            code = f"{prefix}-{datetime.utcnow().strftime('%Y%m%d')}-{random_num}"
            codes.append(code)
        return codes

    async def get_direct_vrf(self, max_value: int) -> int:
        """
        Gọi VRF trực tiếp (cho các trường hợp đặc biệt như generate codes)
        """
        try:
            enable_native_payment = False
            
            nonce = await self.w3.eth.get_transaction_count(self.account.address)
            chain_id = await self.w3.eth.chain_id
            
            tx = await self.consumer_contract.functions.requestRandomWords(
                enable_native_payment
            ).build_transaction({
                'from': self.account.address,
                'nonce': nonce,
                'chainId': chain_id
            })
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = await self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            receipt = await self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            request_id = await self.consumer_contract.functions.lastRequestId().call()
            random_numbers = await self._wait_for_random_words(request_id)
            
            if random_numbers and max_value > 0:
                return random_numbers[0] % max_value
            else:
                return random.randint(0, max_value - 1)
        except Exception as e:
            print(f"Lỗi khi yêu cầu VRF trực tiếp: {e}")
            return random.randint(0, max_value - 1)

    async def get_random_int(self, max_value: int) -> int:
        """
        Lấy số ngẫu nhiên sử dụng batch VRF manager để tối ưu hiệu suất
        """
        try:
            # Sử dụng batch manager thay vì gọi VRF trực tiếp
            return await self.batch_manager.get_random_int(max_value)
        except Exception as e:
            print(f"Lỗi khi yêu cầu số nguyên ngẫu nhiên từ VRF: {e}")
            return random.randint(0, max_value - 1)