# Image-to-Markdown VLM Tool

Local CLI tool that uses Qwen2.5-VL-7B-Instruct with 4-bit quantization to convert UI screenshots into comprehensive Markdown documentation.

## Hardware Requirements

- NVIDIA GPU with 16GB+ VRAM (tested on RTX 4070 Ti Super)
- CUDA 12.4+ support

## Setup

### 1. Activate Virtual Environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

This will install:
- PyTorch with CUDA 12.4 support
- Transformers (Hugging Face)
- BitsAndBytes (4-bit quantization)
- Qwen-VL-Utils
- Other required packages

## Usage

```powershell
python main.py
```

Then paste an image URL when prompted. The tool will:
1. Download the image
2. Process it with the VLM
3. Generate comprehensive Markdown documentation
4. Save to `./output/` folder
5. Clear the cached image

Type `q` to quit.

## Output

Generated Markdown files include:
- Complete UI element descriptions
- Visual styling details
- Layout structure
- Color schemes and typography
- All visible text and controls

## Notes

- First run will download the ~7GB model from Hugging Face
- Inference takes ~5-10 seconds per image on RTX 4070 Ti Super
- Uses 4-bit NF4 quantization to fit in 16GB VRAM
