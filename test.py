from openai import OpenAI

client = OpenAI(
  base_url="https://api.r9s.ai/v1",
  api_key="sk-tNNH1T8sHDX3Msyf565a3bA9Bc3e4b2cB84c8eE393Bb082b",
)

completion = client.chat.completions.create(
  model="glm-5.1",
  messages=[
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ]
)

print(completion.choices[0].message.content)