import gradio as gr

from object_identification import (
    MAX_PHOTOS,
    format_result,
    identify,
    log_turn,
    needs_more,
)


def process_message(message, history, photo_paths, hints, location, year):
    files = message.get("files", [])
    text = (message.get("text") or "").strip()

    if not files and not text:
        response = "Upload a photo or type a hint to get started."

    elif not files and not photo_paths:
        response = "Please upload a photo first so I can identify the appliance."

    else:
        for f in files:
            if len(photo_paths) < MAX_PHOTOS:
                photo_paths = photo_paths + [f]
        if text:
            hints = hints + [text]

        # Prompt for missing context on first photo upload, then still run
        missing = []
        if files and not location:
            missing.append("the country or region where it was purchased")
        if files and not year:
            missing.append("the approximate purchase year")

        try:
            result = identify(
                photo_paths,
                hints=hints or None,
                location=location or None,
                year=year or None,
            )
            log_turn(photo_paths, hints, result)
        except Exception as e:
            result = {"error": str(e)}

        response = format_result(result)
        if missing:
            response += (
                "\n\nTip: providing "
                + " and ".join(missing)
                + " (fields above) would help me narrow down the exact model."
            )
        follow_up = needs_more(result, len(photo_paths))
        if follow_up:
            response += "\n\n" + follow_up

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

    gr.Markdown("## Appliance Identifier\nUpload photos of your appliance to identify it.")

    with gr.Row():
        location_input = gr.Textbox(
            label="Location / Country",
            placeholder="e.g. France, UK, Germany",
            scale=2,
        )
        year_input = gr.Textbox(
            label="Approx. purchase year",
            placeholder="e.g. 2018",
            scale=1,
        )

    chatbot = gr.Chatbot(height=500)
    msg = gr.MultimodalTextbox(
        placeholder="Upload a photo or type a hint...",
        file_types=["image"],
        file_count="multiple",
    )
    clear_btn = gr.Button("New appliance", variant="secondary", size="sm")

    msg.submit(
        process_message,
        inputs=[msg, chatbot, photo_state, hints_state, location_input, year_input],
        outputs=[chatbot, photo_state, hints_state, msg],
    )

    clear_btn.click(
        lambda: ([], [], [], gr.MultimodalTextbox(value=None), None, None),
        outputs=[chatbot, photo_state, hints_state, msg, location_input, year_input],
    )

if __name__ == "__main__":
    demo.launch()
