from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.utils.logging_config import app_logger

# Create PostgreSQL engine
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.debug,
)

app_logger.info(f"✅ PostgreSQL engine created")
app_logger.info(f"📊 Database: {settings.database_url.split('@')[-1].split('/')[0]}")

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class
Base = declarative_base()

def get_db():
    """Dependency for database session"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        app_logger.error(f"Database error: {str(e)}")
        raise
    finally:
        db.close()

def init_db():
    """Initialize database connection"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            app_logger.info(f"🐘 PostgreSQL: {version.split(',')[0]}")
        app_logger.info("✅ Database connection successful")
    except Exception as e:
        app_logger.error(f"❌ Database connection failed: {str(e)}")
        raise

def create_tables():
    """Create all tables (fallback if alembic not used)"""
    try:
        from app.models.template import TemplateModel
        Base.metadata.create_all(bind=engine)
        app_logger.info("✅ Tables created successfully")
    except Exception as e:
        app_logger.error(f"❌ Table creation failed: {str(e)}")
        raise
