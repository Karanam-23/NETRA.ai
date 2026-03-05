import os
from celery import Celery

# Initialize Celery explicitly here so other files can import it safely
celery_app = Celery('netra_tasks', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

