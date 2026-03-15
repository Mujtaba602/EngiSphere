from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# تحديد اسم ملف قاعدة البيانات الذي سيظهر في مجلدك
SQLALCHEMY_DATABASE_URL = "sqlite:///./engisphere.db"

# إنشاء المحرك الذي سيتعامل مع الملف
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# تجهيز الجلسات (Sessions) لإضافة أو قراءة البيانات لاحقاً
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# الأساس الذي سنبني عليه كل جداولنا
Base = declarative_base()