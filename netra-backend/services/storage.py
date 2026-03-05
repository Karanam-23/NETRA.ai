import datetime
from firebase_admin import storage

def upload_evidence(org_id: str, incident_id: str, file_path: str, file_type: str) -> str:
    """
    Uploads a snapshot or clip to Firebase Storage and returns an ephemeral Signed URL.
    file_type must be either 'clip' or 'snapshot'.
    """
    # Get the default storage bucket
    bucket = storage.bucket()
    
    # 1. Determine destination path & MIME type based on file type
    if file_type == 'clip':
        destination_blob_name = f"clips/{org_id}/{incident_id}/clip.mp4"
        content_type = 'video/mp4'
    elif file_type == 'snapshot':
        destination_blob_name = f"snapshots/{org_id}/{incident_id}.jpg"
        content_type = 'image/jpeg'
    else:
        raise ValueError("Invalid file_type. Must be 'clip' or 'snapshot'.")
        
    # 2. Upload the file
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(file_path, content_type=content_type)
    print(f"Uploaded {file_type} to gs://{bucket.name}/{destination_blob_name}")
    
    # 3. Generate a Signed URL valid for exactly 1 hour
    signed_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(hours=1),
        method="GET" # Restrict this URL to GET requests only
    )
    
    return signed_url
