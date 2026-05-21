class DocumentAutomationError(Exception):
    """Base exception for document automation"""
    pass

class TemplateNotFoundError(DocumentAutomationError):
    pass

class PlaceholderExtractionError(DocumentAutomationError):
    pass

class AIValidationError(DocumentAutomationError):
    pass

class RenderError(DocumentAutomationError):
    pass

class InvalidPlaceholderError(DocumentAutomationError):
    pass

class FileUploadError(DocumentAutomationError):
    pass