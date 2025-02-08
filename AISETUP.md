# Documentation for Installing In-Browser AI

Last Updated 2/8/2025

1. Navigate to https://github.com/papayaverse/agent_papaya
2. Clone the repository
    
    ```
    // cd to desired folder in your Terminal
    
    git clone https://github.com/papayaverse/agent_papaya.git
    ```
    
3. Navigate to chrome://extensions
4. Select <Load unpacked> and select the folder where agent_papaya 
5. Navigate to chrome://flags
6. Ensure that <Prompt API for Gemini Nano> is enabled
7. Ensure that <Optimization Guide on Device> is “Enabled bypass perf requirement” 
8. Navigate to https://chrome.dev/web-ai-demos/prompt-api-playground/
9. Type a prompt (ex. “Hello World!”) and ensure that the prompt returns an output 
10. Open Incognito mode and navigate to any website with a cookie banner, e.g.  https://www.hobbs.com/us/product/petite-saskia-shower-resistant-trench-coat/0122-3991-9057L04-NAVY.html 

Important: this will take a while the first time, as the LLM is downloading on your device.