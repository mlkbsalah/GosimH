from openai import OpenAI
import gradio as gr
import os

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)

def respond(message, history):

    response = client.chat.completions.create(
        model="z-ai/glm-5v-turbo",
        messages=[
            {
                "role": "user", 
                "content": [
                    {"type": "text", "text": message}
                    ]}
        ]
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    gr.ChatInterface(fn=respond, multimodal=False).launch()