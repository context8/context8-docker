from typing import List, Optional, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime


Visibility = Literal["private", "team"]


class SolutionBase(BaseModel):
    title: str
    errorMessage: str
    errorType: str
    context: str
    rootCause: str
    solution: str
    codeChanges: Optional[str] = None
    tags: List[str]
    conversationLanguage: Optional[str] = None
    programmingLanguage: Optional[str] = None
    vibecodingSoftware: Optional[str] = None
    visibility: Optional[Visibility] = None
    projectPath: Optional[str] = None
    environment: Optional[Any] = None
    embedding: Optional[list[float]] = None

    class Config:
        populate_by_name = True


class SolutionCreate(SolutionBase):
    pass


class SolutionOut(SolutionBase):
    id: str
    createdAt: datetime
    upvotes: int = 0
    downvotes: int = 0
    voteScore: int = 0
    myVote: Optional[int] = None
    embedding_status: Optional[str] = Field(default=None, alias="embeddingStatus")
    embedding_error: Optional[str] = Field(default=None, alias="embeddingError")
    embedding_updated_at: Optional[datetime] = Field(default=None, alias="embeddingUpdatedAt")

    class Config:
        from_attributes = True
        json_encoders = {bytes: lambda b: b.hex()}
        populate_by_name = True


class SolutionListItem(BaseModel):
    id: str
    title: str
    errorMessage: str
    errorType: str
    tags: List[str]
    conversationLanguage: Optional[str] = None
    programmingLanguage: Optional[str] = None
    vibecodingSoftware: Optional[str] = None
    visibility: Optional[Visibility] = None
    upvotes: Optional[int] = None
    downvotes: Optional[int] = None
    voteScore: Optional[int] = None
    createdAt: datetime

    class Config:
        populate_by_name = True


class PaginatedSolutions(BaseModel):
    items: List[SolutionListItem]
    total: int
    limit: int
    offset: int

    class Config:
        populate_by_name = True


class SolutionVisibilityUpdate(BaseModel):
    visibility: Visibility

    class Config:
        populate_by_name = True


class SolutionVisibilityOut(BaseModel):
    id: str
    visibility: Visibility

    class Config:
        populate_by_name = True


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = 25
    offset: int = 0
    visibility: Optional[Visibility] = None


class SearchResult(BaseModel):
    id: str
    title: str
    errorType: str
    tags: List[str]
    createdAt: datetime
    preview: str
    errorMessage: Optional[str] = None
    solution: Optional[str] = None
    visibility: Optional[Visibility] = None
    apiKeyId: Optional[str] = None
    vibecodingSoftware: Optional[str] = None
    upvotes: Optional[int] = None
    downvotes: Optional[int] = None
    voteScore: Optional[int] = None


class SearchResponse(BaseModel):
    total: int
    results: List[SearchResult]


class CountResponse(BaseModel):
    total: int


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    limit: int = 5


class ChatResponse(BaseModel):
    reply: str
    hits: List[SearchResult]
    toolTrace: List[str]


class OpenAIChatMessage(BaseModel):
    role: str
    content: str


class OpenAIChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[OpenAIChatMessage]
    stream: Optional[bool] = False
    temperature: Optional[float] = None


class VoteRequest(BaseModel):
    value: int


class VoteResponse(BaseModel):
    solutionId: str
    upvotes: int
    downvotes: int
    voteScore: int
    myVote: Optional[int] = None
