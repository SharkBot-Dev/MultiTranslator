const SERVICES = {
    "google": "Google 翻訳",
    "deepl": "DeepL (一部無料/キー必要)",
    "mymemory": "MyMemory (無料/キー不要)"
};

const LANGUAGES = {
    "ja": "日本語",
    "en": "英語",
    "zh": "中国語",
    "es": "スペイン語",
    "fr": "フランス語",
    "ko": "韓国語"
};

const input = document.getElementById("input");
const input_lang = document.getElementById("input_lang");
const target_lang = document.getElementById("target_lang");
const outputs_wrapper = document.getElementById("outputs_wrapper");
const add_output_btn = document.getElementById("add_output_btn");

const deepl_key_input = document.getElementById("deepl_key_input");
const toggle_key_btn = document.getElementById("toggle_key_btn");

let DEEPL_API_KEY = ""; 
let activeOutputs = [];

function populateSelect(selectElement, optionsObject, selectedValue) {
    selectElement.innerHTML = "";
    Object.entries(optionsObject).forEach(([code, name]) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = name;
        if (code === selectedValue) option.selected = true;
        selectElement.appendChild(option);
    });
}

chrome.storage.local.get(['inlang', 'outlang', 'input', 'servicesConfig', 'deeplApiKey']).then((result) => {
    populateSelect(input_lang, LANGUAGES, result.inlang || "ja");
    populateSelect(target_lang, LANGUAGES, result.outlang || "en");
    if (result.input) input.value = result.input;
    
    if (result.deeplApiKey) {
        DEEPL_API_KEY = result.deeplApiKey;
        deepl_key_input.value = result.deeplApiKey;
    }

    if (result.servicesConfig && result.servicesConfig.length > 0) {
        result.servicesConfig.forEach(cfg => {
            createOutputDOM(cfg.id, cfg.service, cfg.text);
        });
    } else {
        createOutputDOM("default_google", "google", "");
        createOutputDOM("default_mymemory", "mymemory", "");
    }
    console.log("セーブ復元完了");
    translateAll();
});

async function translate_google(source, target, text) {
    if (!text.trim()) return "";
    try {
        const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&dj=1&q=${encodeURIComponent(text)}`);
        const data = await resp.json();
        return data.sentences.map(s => s.trans || "").join("");
    } catch (e) {
        console.error("Google翻訳エラー:", e);
        return "Google翻訳でエラーが発生しました";
    }
}

async function translate_deepl(source, target, text) {
    if (!text.trim()) return "";
    if (!DEEPL_API_KEY.trim()) return "DeepLのAPIキーが未設定です。下部の入力欄にキーを設定してください。";

    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: 'translateDeepl', text: text, inlang: source, outlang: target },
            (response) => {
                if (chrome.runtime.lastError) {
                    resolve("通信エラーが発生しました。");
                } else if (response && response.text) {
                    resolve(response.text);
                } else {
                    resolve("翻訳結果を取得できませんでした。");
                }
            }
        );
    });
}

async function translate_mymemory(source, target, text) {
    if (!text.trim()) return "";
    try {
        const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`);
        const data = await resp.json();
        return data.responseData.translatedText;
    } catch (e) {
        console.error("MyMemoryエラー:", e);
        return "MyMemory翻訳でエラーが発生しました";
    }
}

async function callTranslator(service, source, target, text) {
    switch (service) {
        case "google": return await translate_google(source, target, text);
        case "deepl": return await translate_deepl(source, target, text);
        case "mymemory": return await translate_mymemory(source, target, text);
        default: return "未対応のサービスです";
    }
}

async function translateAll() {
    const sourceText = input.value;
    const sourceLang = input_lang.value;
    const targetLang = target_lang.value;

    if (!sourceText.trim()) {
        activeOutputs.forEach(out => out.textarea.value = "");
        return;
    }

    activeOutputs.forEach(out => {
        out.textarea.value = "翻訳中...";
    });

    const promises = activeOutputs.map(async (out) => {
        const transText = await callTranslator(out.serviceSelect.value, sourceLang, targetLang, sourceText);
        out.textarea.value = transText;
    });

    await Promise.all(promises);
    saveState();
}

function createOutputDOM(id, initialService, initialText) {
    const container = document.createElement("div");
    container.className = "output-container";
    container.dataset.id = id;

    const header = document.createElement("div");
    header.className = "output-header";

    const select = document.createElement("select");
    select.className = "lang-select";
    populateSelect(select, SERVICES, initialService);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "✕ 削除";

    header.appendChild(select);
    header.appendChild(removeBtn);

    const textarea = document.createElement("textarea");
    textarea.placeholder = "翻訳結果が表示されます";
    textarea.value = initialText;

    container.appendChild(header);
    container.appendChild(textarea);
    outputs_wrapper.appendChild(container);

    const outputObj = { id, serviceSelect: select, textarea };
    activeOutputs.push(outputObj);

    select.addEventListener("change", async () => {
        textarea.value = "翻訳中...";
        const transText = await callTranslator(select.value, input_lang.value, target_lang.value, input.value);
        textarea.value = transText;
        saveState();
    });

    textarea.addEventListener("change", async (event) => {
        input.value = "同期中...";
        const transText = await callTranslator(select.value, target_lang.value, input_lang.value, event.target.value);
        input.value = transText;
        translateAll();
    });

    removeBtn.addEventListener("click", () => {
        container.remove();
        activeOutputs = activeOutputs.filter(out => out.id !== id);
        saveState();
    });
}

add_output_btn.addEventListener("click", () => {
    const newId = Date.now().toString();
    createOutputDOM(newId, "google", "");
    translateAll();
});

function saveState() {
    const servicesConfig = activeOutputs.map(out => ({
        id: out.id,
        service: out.serviceSelect.value,
        text: out.textarea.value
    }));

    chrome.storage.local.set({
        inlang: input_lang.value,
        outlang: target_lang.value,
        input: input.value,
        servicesConfig: servicesConfig,
        deeplApiKey: DEEPL_API_KEY 
    }).then(() => {
        console.log("状態を保存しました");
    });
}

deepl_key_input.addEventListener("input", (e) => {
    DEEPL_API_KEY = e.target.value;
    saveState();
});

deepl_key_input.addEventListener("change", () => {
    translateAll();
});

toggle_key_btn.addEventListener("click", () => {
    if (deepl_key_input.type === "password") {
        deepl_key_input.type = "text";
        toggle_key_btn.textContent = "隠す";
    } else {
        deepl_key_input.type = "password";
        toggle_key_btn.textContent = "表示";
    }
});

input.addEventListener("change", translateAll);
input_lang.addEventListener("change", translateAll);
target_lang.addEventListener("change", translateAll);