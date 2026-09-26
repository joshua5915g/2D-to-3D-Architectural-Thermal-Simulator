import os
import logging
from typing import Optional, Any
import firebase_admin
from firebase_admin import credentials, firestore, storage
from app.config import settings

logger = logging.getLogger(__name__)

_firestore_client: Optional[Any] = None
_storage_bucket: Optional[Any] = None


def init_firebase_admin():
    global _firestore_client, _storage_bucket

    if not firebase_admin._apps:
        key_path = settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH
        if key_path and os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(
                cred,
                {
                    "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
                    "projectId": settings.FIREBASE_PROJECT_ID,
                },
            )
            logger.info("Firebase Admin initialized with service account key: %s", key_path)
        else:
            try:
                # Fallback to application default credentials
                firebase_admin.initialize_app(
                    options={
                        "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
                        "projectId": settings.FIREBASE_PROJECT_ID,
                    }
                )
                logger.info("Firebase Admin initialized with default credentials.")
            except Exception as e:
                logger.warning(
                    "Firebase Admin running in mock/offline mode (credentials not configured): %s",
                    e,
                )
                return None, None

    try:
        _firestore_client = firestore.client()
        _storage_bucket = storage.bucket()
    except Exception as e:
        logger.warning("Could not instantiate Firestore/Storage client: %s", e)

    return _firestore_client, _storage_bucket


def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        init_firebase_admin()
    return _firestore_client


def get_storage_bucket():
    global _storage_bucket
    if _storage_bucket is None:
        init_firebase_admin()
    return _storage_bucket
