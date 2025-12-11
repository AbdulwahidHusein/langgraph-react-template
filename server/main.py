from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import logging

from langchain_core.messages import HumanMessage
from agent import graph
from config import SERVER_HOST, SERVER_PORT

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LangGraph Chat API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    thread_id: str
    message: str

async def stream_chat(thread_id: str, message: str):
    """Stream chat responses with tool calls"""
    try:
        config = {"configurable": {"thread_id": thread_id}}
        inputs = {"messages": [HumanMessage(content=message)]}
        
        async for event in graph.astream_events(inputs, config, version="v2"):
            kind = event.get("event")
            node_name = event.get("metadata", {}).get("langgraph_node", "")
            
            # Stream tokens
            if kind == "on_chat_model_stream" and node_name == "agent":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
            
            # Tool events
            elif kind == "on_tool_start" and node_name == "tools":
                tool_name = event.get("name", "")
                tool_input = event.get("data", {}).get("input", {})
                yield f"data: {json.dumps({'type': 'tool_start', 'tool': tool_name, 'input': tool_input})}\n\n"
            
            elif kind == "on_tool_end" and node_name == "tools":
                tool_name = event.get("name", "")
                output = event.get("data", {}).get("output", "")
                if hasattr(output, "content"):
                    output = output.content
                yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': output})}\n\n"
            
            # Graph finished
            elif kind == "on_chain_end" and event.get("name") == "LangGraph":
                yield f"data: {json.dumps({'type': 'status', 'status': 'done'})}\n\n"
    
    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

@app.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint with streaming support"""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    return StreamingResponse(
        stream_chat(request.thread_id, request.message),
        media_type="text/event-stream"
    )

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {SERVER_HOST}:{SERVER_PORT}")
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)

