const path = new URL(location.href);
const text = path.searchParams.get('text')

const inputArea = document.querySelector('textarea[aria-label="原文"]');
const outputArea = document.querySelector('div[class="cJ1Ndf"]')

function translate(text) {
    Array.from(document.getElementsByTagName("textarea")).forEach((e) => {
        if (e.id.startsWith("output-t-")) {
            try {
                e.remove()
            } catch {}
        }
    })

    const output = document.createElement("textarea");
    output.className = "QsA0jb";
    output.id = `output-t-${new Date()}`
    output.value = text
    outputArea.appendChild(output);
}

inputArea.addEventListener("input", (ie) => {
    translate(ie.target.value)
})