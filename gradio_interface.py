import gradio as gr

from object_identification import (
    MAX_PHOTOS,
    _format_result,
    identify,
    log_turn,
    next_step,
)


def process_message(message, history, photo_paths, hints):
    files = message.get("files", [])
    text = (message.get("text") or "").strip()
    response = ""

    if files:
        for f in files:
            if len(photo_paths) < MAX_PHOTOS:
                photo_paths = photo_paths + [f]
        if text:
            hints = hints + [text]
        try:
            result = identify(photo_paths, hints or None)
            log_turn(photo_paths, hints, result)
        except Exception as e:
            result = {"error": str(e)}
        response = _format_result(result)
        follow_up = next_step(result, len(photo_paths))
        if follow_up:
            response += "\n\n" + follow_up

    elif text:
        if not photo_paths:
            response = "Please upload a photo first so I can identify the appliance."
        else:
            hints = hints + [text]
            try:
                result = identify(photo_paths, hints)
                log_turn(photo_paths, hints, result)
            except Exception as e:
                result = {"error": str(e)}
            response = _format_result(result)
            follow_up = next_step(result, len(photo_paths))
            if follow_up:
                response += "\n\n" + follow_up

    else:
        response = "Upload a photo or type a hint to get started."

    if files and text:
        user_display = f"{text} [{len(files)} photo(s)]"
    elif files:
        user_display = f"[{len(files)} photo(s)]"
    else:
        user_display = text

    history = history + [
        {"role": "user", "content": user_display},
        {"role": "assistant", "content": response},
    ]
    return history, photo_paths, hints, gr.MultimodalTextbox(value=None)


with gr.Blocks(title="Appliance Identifier") as demo:
    photo_state = gr.State([])
    hints_state = gr.State([])

    gr.Markdown("## Appliance Identifier\nUpload photos of your appliance to identify it. Add text hints to improve accuracy.")

    chatbot = gr.Chatbot(height=500)
    msg = gr.MultimodalTextbox(
        placeholder="Upload a photo or type a hint...",
        file_types=["image"],
        file_count="multiple",
    )

    msg.submit(
        process_message,
        inputs=[msg, chatbot, photo_state, hints_state],
        outputs=[chatbot, photo_state, hints_state, msg],
    )

if __name__ == "__main__":
    demo.launch()
