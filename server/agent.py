from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage
from langchain_tavily import TavilySearch
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode, tools_condition
from config import MODEL_NAME, MODEL_TEMPERATURE, TAVILY_MAX_RESULTS

# Tools
tavily_search = TavilySearch(max_results=TAVILY_MAX_RESULTS)
tools = [tavily_search]

# LLM
llm = ChatOpenAI(model=MODEL_NAME, temperature=MODEL_TEMPERATURE, streaming=True) #for gemini you could use from langchain_google_genai import ChatGoogleGenerativeAI
llm_with_tools = llm.bind_tools(tools)

# Agent node
def agent_node(state: MessagesState):
    system_msg = SystemMessage(
        content="You are a helpful assistant with web search capabilities. When users ask questions that require current information or web search, use the available search tool to find relevant information."
    )
    response = llm_with_tools.invoke([system_msg] + state["messages"])
    return {"messages": [response]}

# Build graph
builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", ToolNode(tools))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", tools_condition)
builder.add_edge("tools", "agent")

memory = MemorySaver()
graph = builder.compile(checkpointer=memory)

