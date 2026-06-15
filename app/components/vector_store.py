import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Optional, Dict, Any
from app.utils.config import config
from app.components.embeddings import EmbeddingsComponent
import os
import shutil
import json

# Simple Document class
class SimpleDocument:
    def __init__(self, page_content: str, metadata: Dict[str, Any] = None):
        self.page_content = page_content
        self.metadata = metadata or {}

class VectorStoreComponent:
    def __init__(self):
        self.embeddings_component = EmbeddingsComponent()
        self.collection_name = "pdf_documents"
        self.client = None
        self.collection = None
        self.vector_store = None
        self.use_memory_only = False

        # Initialize Chroma client
        self._init_chroma()
    
    def _init_chroma(self):
        """Initialize ChromaDB client - try persistent first, fallback to in-memory"""
        try:
            # Ensure directory exists
            os.makedirs(config.VECTOR_STORE_PATH, exist_ok=True)
            
            # Try persistent client
            self.client = chromadb.PersistentClient(
                path=config.VECTOR_STORE_PATH,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                    is_persistent=True
                )
            )
            print(f"✅ ChromaDB persistent client initialized at {config.VECTOR_STORE_PATH}")
            self.use_memory_only = False
            
        except Exception as e:
            print(f"⚠️ Persistent client failed: {e}")
            print("🔄 Falling back to in-memory client (data won't persist after restart)")
            try:
                # Fallback to in-memory client
                self.client = chromadb.Client(
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
                self.use_memory_only = True
                print(f"✅ ChromaDB in-memory client initialized")
            except Exception as e2:
                print(f"❌ Failed to initialize ChromaDB: {e2}")
                self.client = None
    
    def _get_or_create_collection(self):
        """Get or create collection"""
        if self.collection is not None:
            return self.collection
        
        if self.client is None:
            print("❌ No ChromaDB client available")
            return None
        
        try:
            # Try to get existing collection
            self.collection = self.client.get_collection(self.collection_name)
            print(f"✅ Loaded existing collection: {self.collection_name}")
        except Exception:
            try:
                # Create new collection
                self.collection = self.client.create_collection(
                    name=self.collection_name,
                    metadata={"hnsw:space": "cosine"}
                )
                print(f"✅ Created new collection: {self.collection_name}")
            except Exception as e:
                print(f"❌ Failed to create collection: {e}")
                return None
        
        return self.collection
    
    def create_vector_store(self, documents: List) -> bool:
        """Create vector store from documents"""
        try:
            # Delete existing collection if in-memory mode
            if self.use_memory_only and self.client:
                try:
                    self.client.delete_collection(self.collection_name)
                except Exception:
                    pass
            
            self.collection = None
            collection = self._get_or_create_collection()
            
            if collection is None:
                raise Exception("Could not create or get collection")
            
            # Prepare documents for insertion
            ids = []
            embeddings = []
            metadatas = []
            documents_text = []
            
            for i, doc in enumerate(documents):
                doc_id = f"doc_{i}_{hash(doc.page_content) % 10000}"
                ids.append(doc_id)
                
                # Generate embedding
                embedding = self.embeddings_component.embed_query(doc.page_content)
                embeddings.append(embedding)
                
                # Metadata
                metadata = dict(doc.metadata)
                metadatas.append(metadata)
                documents_text.append(doc.page_content)
            
            # Add all documents at once (not batch - simpler)
            try:
                collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    metadatas=metadatas,
                    documents=documents_text
                )
                print(f"✅ Added all {len(ids)} documents at once")
            except Exception as batch_error:
                print(f"⚠️ Batch add failed: {batch_error}")
                # Try one by one
                success_count = 0
                for j in range(len(ids)):
                    try:
                        collection.add(
                            ids=[ids[j]],
                            embeddings=[embeddings[j]],
                            metadatas=[metadatas[j]],
                            documents=[documents_text[j]]
                        )
                        success_count += 1
                    except Exception as single_error:
                        print(f"❌ Failed to add document {j}: {single_error}")
                print(f"✅ Added {success_count}/{len(ids)} documents")
            
            # Set vector_store for compatibility
            self.vector_store = collection
            
            # Verify count
            final_count = collection.count()
            print(f"✅ Vector store now has {final_count} documents")
            return final_count > 0
            
        except Exception as e:
            print(f"❌ Failed to create vector store: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def load_vector_store(self) -> bool:
        """Load existing vector store"""
        try:
            collection = self._get_or_create_collection()
            if collection is None:
                return False
            
            count = collection.count()
            self.vector_store = collection
            print(f"✅ Loaded vector store with {count} documents")
            return True
        except Exception as e:
            print(f"⚠️ Failed to load vector store: {e}")
            return False
    
    def add_documents(self, documents: List) -> bool:
        """Add new documents to existing store"""
        try:
            collection = self._get_or_create_collection()
            if collection is None:
                return False
            
            # Get current count for IDs
            current_count = collection.count()
            
            ids = []
            embeddings = []
            metadatas = []
            documents_text = []
            
            for i, doc in enumerate(documents):
                doc_id = f"doc_{current_count + i}_{hash(doc.page_content) % 10000}"
                ids.append(doc_id)
                
                embedding = self.embeddings_component.embed_query(doc.page_content)
                embeddings.append(embedding)
                
                metadata = dict(doc.metadata)
                metadatas.append(metadata)
                documents_text.append(doc.page_content)
            
            # Add all at once
            try:
                collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    metadatas=metadatas,
                    documents=documents_text
                )
                print(f"✅ Added {len(ids)} documents")
            except Exception as e:
                print(f"❌ Failed to add documents: {e}")
                return False
            
            self.vector_store = collection
            new_count = collection.count()
            print(f"✅ Total documents: {new_count}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to add documents: {e}")
            return False
    
    def similarity_search(self, query: str, k: int = 4) -> List:
        """Search for similar documents"""
        try:
            collection = self._get_or_create_collection()
            if collection is None:
                print("❌ No collection available")
                return []
            
            count = collection.count()
            print(f"🔍 Searching in collection with {count} documents")
            
            if count == 0:
                print("⚠️ Collection is empty!")
                return []
            
            # Generate query embedding
            query_embedding = self.embeddings_component.embed_query(query)
            
            # Search
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, count),
                include=["documents", "metadatas", "distances"]
            )
            
            print(f"📊 Search returned {len(results['documents'][0]) if results['documents'] else 0} results")
            
            # Format results
            formatted_results = []
            if results['documents'] and results['documents'][0]:
                for i in range(len(results['documents'][0])):
                    doc = SimpleDocument(
                        page_content=results['documents'][0][i],
                        metadata=results['metadatas'][0][i] if results['metadatas'] else {}
                    )
                    formatted_results.append(doc)
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Similarity search failed: {e}")
            return []
    
    def delete_vector_store(self) -> bool:
        """Delete vector store"""
        try:
            if self.client:
                try:
                    self.client.delete_collection(self.collection_name)
                except Exception:
                    pass
            
            self.collection = None
            self.vector_store = None
            print(f"✅ Deleted vector store")
            return True
        except Exception as e:
            print(f"❌ Failed to delete vector store: {e}")
            return False