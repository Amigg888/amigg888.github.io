import base64
import zlib
import json

def try_decompress(b64_data):
    data = base64.b64decode(b64_data)
    
    # 方法 1: 标准 decompress
    try:
        print("Method 1: standard decompress")
        return zlib.decompress(data).decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Method 1 failed: {e}")

    # 方法 2: -MAX_WBITS (raw deflate)
    try:
        print("Method 2: -MAX_WBITS")
        return zlib.decompress(data, -zlib.MAX_WBITS).decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Method 2 failed: {e}")

    # 方法 3: 尝试跳过头部 (比如 2 字节)
    try:
        print("Method 3: skip 2 bytes")
        return zlib.decompress(data[2:]).decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Method 3 failed: {e}")

    return None

if __name__ == "__main__":
    # 从 intercepted_raw_v2.json 中取出的字符串片段
    test_str = "eAHs3FtsHNd5AOCZ2dvZs0tyuLwtR+JFw4vIFSXuzt6pG7kkVxJ1oy6UqEsAI0iBQmiRwMhD7TQoHVuRLMs2HSeWRMuyFUeOSsey1TgKLduyi74EecpDX5q+pC13SRYokocCfSuKc+bs2X9n95dTm0T7EBswzsycy3f+8+/szFlL9KWPVaIaiumjnviO6I5o5BmVuCPfNQj1fvvp6Nez3zJDVI8Vb14uXrmz+v6j4vWXVj7+fqSLKgtqiOqx4s3L8MKvVPW3qkZUayvtpH6/wv/5w16jXIy4qZaz9msXNKIuqMpIE9VIXaR03Rod0YgaWakjdU/+ax1A1BE15CYn9BOGa0FVTItoIcUcmiq1Oze6wIb9rSpOdG8f/Xe1jnoeqhqhI27iCmvmkkq0kJuoumq+p9K/oU9RxVAiM9RDXVTdTRtpA60bOzIxcODEkZnDucnjA3TIiFDFUCLKiDKlnFUuaER9WiPqFZXbNaIuqspDVfm1qvxWVWiA+qlvcOjk8ZnJwVnPn6tcxGtoRP01+88VTVnUNKIaGlEl/byDPrKjmv4rN6drumZ+6qa33PSamypTURqkNJbOxizLiifjLFrF1z4oXrkTCVB/T5T/Mxkd8VNfTz6fS+bidot4Om5FY9GoxVusfPze6ocf1WwRnxifirMxMumolbCyGcsyAtS/vDRXeP+j5aW56kZj45PWeFIMY2VT2UQinogxWOHewtqlV2q0mBjP5fNTe9gwyYQVtxLZaMwyWmlz4eWrhRefWV6aS2UKF59dff9R8dqDSNXExiYmE/n8VJa3z0RT2Uw0kYkZjbSheO3B8sMXVp7/aOXuZ6vvP6oxtI3NsabpaDadTqZj2bRh0HBh6Z2VN+bWbj8svPx28eHN4tLS8tJ7hdc/jVQNL+LKoxTPptOJVCYZi7IoFS7+cvX+7dzR2eqB8/nxybH4VIoNnLGiViadSaczRj0NFq+/ufzw3cKLt6ef/GatdpNj2eys+4tSS34KZrdVp1I/zySX7jY3P7be39ufFo/uMR+o9JpK51Wq2OZEMhvPZDLxVIyZl5c+LNx7vvjW7cLVh5jZbpeJxuKJWCqZSrF2xetXC1dfw9rZefEV53rLxSfr1b3mqy76nxr9D600B/CxqafBwgcvr165vzr3TGHpcq058A8PXy/w4WHrdfvZwnvzj2nHPkK8XSaRyGRSmXiax6z45sJj27F1tttlk/FULBNPJHnMmPPF57HxJuL5+KRlJ2Milcxkk/GEFePJWPos1ZrcxPhEzh4sFo9aaSueshdoZX5xZX4RGyyfnxyfyM36v1Iypgi7I/t0X/lWPv+04374s0PVSWy3Izopt5v7mqPdPw5j7fy6v9xO+bqj3V/Eq9vZHxqqB7/gQxPl86nT68x+Xe1Wo+qoOq0+oX5LnVPVeVV9S1U/UNXPVfU3qvo7Vf2DqkZaiccKGXrpy1Z3hUm3a6Au8l/vqiS0oP7hXdUIli52nx+oM38TpPWUf6GNqlMK65s22scjLvIzTZwKUS/7zhtRRtUpjXCC45zGm1bWc/Fzut0db+muOuN5Qr2gUKqLqV1QqHZBKbdh02Vf7ZROacTLvzO1Mphd/Ra85gL13KDsodRWXNCIF5z3gTIBZT8oU0rOaoQpAtR9QSNB/t86fpb1V89L7HoDv6LzY3alkZdcFzQSkqUmWWqWpZaq+bZWnWkDMwhTHayHvWhiEUcUcVy5Ej4W91A3ZUtqtNO2p5566imz8NGH5l+axZuXzW+YxWt3zJ2jhv2AYzSVMu"
    
    # 修复 padding
    missing_padding = len(test_str) % 4
    if missing_padding:
        test_str += '=' * (4 - missing_padding)
        
    result = try_decompress(test_str)
    if result:
        print("Successfully decompressed!")
        print(result[:500])
    else:
        print("All methods failed.")
