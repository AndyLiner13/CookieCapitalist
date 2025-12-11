import os
import time
import requests
from datetime import datetime
from PIL import Image
from io import BytesIO
import sys
import subprocess

# Set Hugging Face cache to C drive BEFORE importing transformers
os.environ["HF_HOME"] = "C:/HuggingFace"

import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor, BitsAndBytesConfig
from qwen_vl_utils import process_vision_info

# Configuration
MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"
CACHE_DIR = "./cache"
OUTPUT_DIR = "./output"
HF_CACHE_DIR = "C:/HuggingFace"  # Fast NVMe drive

def check_cuda_and_restart():
    """Check if CUDA is available. If not, restart with correct venv."""
    if not torch.cuda.is_available():
        print("ERROR: CUDA is not available in the current Python environment.")
        print(f"Current Python: {sys.executable}")
        
        # Get the script directory and venv path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        venv_python = os.path.join(script_dir, ".venv", "Scripts", "python.exe")
        
        if os.path.exists(venv_python):
            print(f"\nRestarting with CUDA-enabled Python from: {venv_python}")
            print("-" * 60)
            
            # Restart the script with the venv Python
            subprocess.run([venv_python] + sys.argv)
            sys.exit(0)
        else:
            print(f"\nERROR: Virtual environment not found at: {venv_python}")
            print("\nPlease run:")
            print("  cd image-processor")
            print(r"  .\.venv\Scripts\Activate.ps1")
            print("  python main.py")
            sys.exit(1)

# System Prompt
SYSTEM_PROMPT = """You are an expert image documentation specialist creating accessible descriptions for people who cannot see the image. Your goal is to write a COMPLETE description that allows someone to perfectly visualize the image with their eyes closed.

CORE PRINCIPLES:
1. **Completeness**: Describe EVERYTHING visible - colors, sizes, positions, text, spacing, styling
2. **Verbatim Text**: Copy ALL text EXACTLY word-for-word (no paraphrasing)
3. **Top-Down Structure**: Start broad (overview), then go progressively more detailed
4. **Spatial Clarity**: Always specify WHERE things are (top-left, center, bottom, inside X, next to Y)
5. **Never mention absences**: Only describe what IS there, never what ISN'T

REQUIRED STRUCTURE (adapt based on content):

### Overview
- One paragraph: What type of image is this? What's the main subject/purpose?
- Key visual characteristics (e.g., "A dialog box on a white background" or "A flowchart with blue boxes and connecting arrows")

### Layout & Spatial Organization
Describe the overall structure using spatial terms:
- What are the major regions/containers/sections?
- How are they positioned relative to each other? (left/right, top/bottom, center, overlapping)
- What are their approximate sizes? (takes up full width, small box in corner, etc.)
- Visual hierarchy (what's most prominent?)

### Containers & Content (Hierarchical)
For each visual container (panel, box, card, section), describe in order of visual prominence:

**[Container Name]** (position, size, background color):
> "[Exact title/heading text if present]"
- Visual styling: borders, shadows, corners, padding
- Contents (listed in spatial order - top to bottom, left to right):
  - Element type: exact text in blockquotes or description
  - Position within container
  - Visual properties: color, size, state (enabled/disabled, checked/unchecked)
  - **Nested sub-containers**: indent and repeat structure

### Detailed Visual Properties
Go through ALL visual elements systematically:

**Colors:**
- Background colors (specific shades: "light gray #F5F5F5", "dark blue", etc.)
- Text colors
- Accent colors (borders, highlights, icons)

**Typography:**
- Font styles for different text types (headings vs body)
- Font weights (bold, regular, light)
- Font sizes (relative: large heading, small caption, etc.)
- Text alignment (left, center, right)

**Spacing & Layout:**
- Padding inside containers
- Margins between elements
- Alignment (elements aligned vertically, horizontally, etc.)
- Gaps and whitespace

**Interactive Elements:**
- All buttons, links, inputs: exact text, color, size, position
- Current states (hover, pressed, disabled, selected)
- Icons on buttons (describe icon + position: "checkmark icon on left side of button")

**Visual Indicators:**
- Borders, dividers, separators (color, thickness, style: solid/dashed)
- Shadows and depth effects
- Highlights, outlines, or emphasis boxes
- Badges, labels, tags
- Progress bars, loading indicators
- Icons and graphics (describe what they depict)

FORMATTING GUIDELINES:
- Use **bold** for element types and container names
- Use > blockquotes for ALL text that appears in the image
- Use - bullets for listing properties or elements
- Use indentation to show nesting/hierarchy
- Use ### for major sections, **Name** for sub-sections

CRITICAL RULES:
✓ DO: Describe exact positions ("in the top-left corner", "below the title", "inside the blue panel")
✓ DO: Specify all colors, even if approximate ("light blue", "dark gray border")
✓ DO: Describe sizes relatively ("large heading", "small icon", "takes up 1/3 of width")
✓ DO: Quote all text verbatim in blockquotes WITHIN the relevant container/element descriptions
✓ DO: Mention all visual styling (rounded corners, shadows, gradients, transparency)
✓ DO: Describe spatial relationships between elements

✗ DON'T: Mention what's absent ("no sidebar", "no navigation")
✗ DON'T: Summarize or paraphrase text
✗ DON'T: Create a separate "Text Content (Verbatim)" section - integrate text into element descriptions
✗ DON'T: Skip visual details thinking they're minor
✗ DON'T: Assume function - only describe what's visible
✗ DON'T: Use vague terms like "some text" - quote it exactly
- Truncate or summarize - be exhaustive and complete"""

def setup_directories():
    """Ensure cache and output directories exist."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_model():
    """Load the model and processor once."""
    print(f"Loading model: {MODEL_ID}...")
    print(f"Using cache directory: {HF_CACHE_DIR}")
    print("This may take a moment depending on your internet connection and disk speed.")
    
    try:
        # Configure 4-bit quantization (NF4) for low VRAM usage
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
        )

        # Load model with quantization and multi-threaded loading
        # max_memory helps with efficient GPU allocation
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            MODEL_ID,
            quantization_config=bnb_config,
            device_map="auto",
            cache_dir=HF_CACHE_DIR,
            low_cpu_mem_usage=True,  # More efficient memory usage during loading
        )

        processor = AutoProcessor.from_pretrained(MODEL_ID, cache_dir=HF_CACHE_DIR)

        print("Model Loaded!")
        return model, processor
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Ensure you have installed the requirements: pip install -r requirements.txt")
        exit(1)

def download_image(url):
    """Download image from URL and save to cache."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Generate filename from timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"image_{timestamp}.jpg"
        filepath = os.path.join(CACHE_DIR, filename)
        
        # Verify it's an image
        image = Image.open(BytesIO(response.content))
        # Convert to RGB to handle PNGs with transparency or other formats
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        image.save(filepath)
        return filepath, image
    except Exception as e:
        print(f"Error downloading image: {e}")
        return None, None

def process_image(model, processor, image_path):
    """Run inference on the image."""
    
    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": SYSTEM_PROMPT}],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "image": image_path,
                },
                {"type": "text", "text": "Provide a complete, detailed description of this UI. Include all visible elements, their styling, positioning, and any visual indicators. Structure your response with headers and organize it by sections."},
            ],
        }
    ]

    # Preparation for inference
    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    
    image_inputs, video_inputs = process_vision_info(messages)
    
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    )
    
    inputs = inputs.to("cuda")

    # Inference
    generated_ids = model.generate(**inputs, max_new_tokens=2048)
    
    # Trim the input tokens from the output
    generated_ids_trimmed = [
        out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    
    output_text = processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )
    
    return output_text[0]

def save_output(content, original_url):
    """Save the generated markdown to a file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"output_{timestamp}.md"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"<!-- Source: {original_url} -->\n")
        f.write(f"<!-- Date: {datetime.now().isoformat()} -->\n\n")
        f.write(content)
    
    return filepath

def main():
    # Check CUDA availability first
    check_cuda_and_restart()
    
    setup_directories()
    
    # Step 1: Startup
    model, processor = load_model()
    
    print("\n--- VLM CLI Tool Ready ---")
    print("Enter an image URL to process, or 'q' to quit.")
    
    # Step 2: Loop
    while True:
        try:
            user_input = input("\nImage URL > ").strip()
            
            if user_input.lower() in ['q', 'quit', 'exit']:
                print("Exiting...")
                break
            
            if not user_input:
                continue
                
            # Step 3: Action (Download)
            print(f"Downloading image...")
            image_path, _ = download_image(user_input)
            
            if not image_path:
                continue
                
            # Step 4: Inference
            print("Processing image (this may take a few seconds)...")
            start_time = time.time()
            markdown_content = process_image(model, processor, image_path)
            duration = time.time() - start_time
            
            # Step 5: Output
            output_path = save_output(markdown_content, user_input)
            
            print(f"\nSuccess! ({duration:.2f}s)")
            print(f"Saved to: {output_path}")
            print("-" * 30)
            # Optional: Print a preview
            print(markdown_content[:200] + "..." if len(markdown_content) > 200 else markdown_content)
            
            # Clean up cached image
            try:
                if image_path and os.path.exists(image_path):
                    os.remove(image_path)
                    
                # Clear all remaining cache files
                cache_files = [f for f in os.listdir(CACHE_DIR) if os.path.isfile(os.path.join(CACHE_DIR, f))]
                if cache_files:
                    for cache_file in cache_files:
                        try:
                            os.remove(os.path.join(CACHE_DIR, cache_file))
                        except Exception:
                            pass
                    print(f"Cache cleared: {len(cache_files) + 1} file(s) removed")
                else:
                    print(f"Cache cleared: {os.path.basename(image_path)}")
            except Exception as e:
                print(f"Warning: Could not delete cached image: {e}")
            
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
