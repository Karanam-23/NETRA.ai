import redis
import struct
import json
from typing import Optional, Dict, Any

class FrameBuffer:
    def __init__(self, redis_url: str = "redis://localhost:6379/0", max_depth: int = 30):
        self.redis = redis.Redis.from_url(redis_url)
        self.max_depth = max_depth

    def push_frame(self, org_id: str, camera_id: str, jpeg_bytes: bytes, metadata: Dict[str, Any]):
        """Serializes metadata and JPEG bytes, then pushes to the Redis list."""
        key = f"frames:{org_id}:{camera_id}"
        
        # Serialize metadata to JSON bytes
        meta_bytes = json.dumps(metadata).encode('utf-8')
        meta_len = len(meta_bytes)
        
        # Format: 4-byte unsigned int (length of metadata) + metadata bytes + jpeg bytes
        payload = struct.pack(f">I{meta_len}s", meta_len, meta_bytes) + jpeg_bytes
        
        # Use a pipeline to push and trim atomically
        pipeline = self.redis.pipeline()
        pipeline.lpush(key, payload)  # Push to the "head" (left)
        pipeline.ltrim(key, 0, self.max_depth - 1)  # Drop oldest frames actively
        pipeline.execute()

    def pop_frame(self, org_id: str, camera_id: str) -> Optional[Dict[str, Any]]:
        """Pops the oldest frame from the queue, returning parsed metadata and raw JPEG bytes."""
        key = f"frames:{org_id}:{camera_id}"
        
        # Pop from the "tail" (right) safely maintaining FIFO ordering
        item = self.redis.rpop(key)
        if not item:
            return None
            
        # Unpack the integer prefix to figure out where metadata ends and JPEG begins
        meta_len, = struct.unpack(">I", item[:4])
        meta_bytes = item[4:4+meta_len]
        jpeg_bytes = item[4+meta_len:]
        
        metadata = json.loads(meta_bytes.decode('utf-8'))
        
        return {
            "metadata": metadata,
            "frame_bytes": jpeg_bytes
        }
