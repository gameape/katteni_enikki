// State
let currentState = {
    images: [],
    texts: [],
    currentIndex: 0,
    originalUrl: ''
};

// DOM Elements
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const errorMsg = document.getElementById('errorMsg');
const content = document.getElementById('content');
const mainImage = document.getElementById('mainImage');
const imageNav = document.getElementById('imageNav');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const imageCount = document.getElementById('imageCount');
const textContent = document.getElementById('textContent');
const sourceLink = document.getElementById('sourceLink');

// Event Listeners
loadBtn.addEventListener('click', handleLoad);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLoad();
});
prevBtn.addEventListener('click', showPrevImage);
nextBtn.addEventListener('click', showNextImage);

async function handleLoad() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('URLを入力してください');
        return;
    }

    hideError();
    loadBtn.disabled = true;
    loadBtn.textContent = '読み込み中...';

    try {
        await processUrl(url);
    } catch (err) {
        showError(err.message);
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = '表示';
    }
}

async function processUrl(url) {
    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'https://' + url;
    }

    // Detect URL type and handle accordingly
    if (isTwitterUrl(fullUrl)) {
        await handleTwitterUrl(fullUrl);
    } else if (isInstagramUrl(fullUrl)) {
        await handleInstagramUrl(fullUrl);
    } else {
        // Assume it's a regular webpage
        await handleWebPage(fullUrl);
    }

    currentState.originalUrl = fullUrl;
    displayContent();
}

function isTwitterUrl(url) {
    return /twitter\.com|x\.com/i.test(url);
}

function isInstagramUrl(url) {
    return /instagram\.com/i.test(url);
}

async function handleWebPage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`ページの読み込みに失敗しました (${response.status})`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract images
    const images = doc.querySelectorAll('img');
    currentState.images = [];
    images.forEach((img) => {
        const src = img.src || img.getAttribute('data-src');
        if (src && !src.includes('data:')) {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(src, url).href;
            currentState.images.push(absoluteUrl);
        }
    });

    if (currentState.images.length === 0) {
        throw new Error('このページに画像が見つかりませんでした');
    }

    // Extract text (first image's nearby text)
    currentState.texts = extractTextForImages(doc, images);

    if (currentState.texts.length === 0) {
        currentState.texts = Array(currentState.images.length).fill('');
    }
}

function extractTextForImages(doc, imageElements) {
    const texts = [];

    imageElements.forEach((img) => {
        let text = '';

        // Get alt text
        if (img.alt) {
            text = img.alt;
        } else {
            // Get nearby text
            let parent = img.parentElement;
            while (parent && text.length < 300) {
                const siblings = Array.from(parent.children);
                for (let sibling of siblings) {
                    if (sibling !== img && sibling.textContent) {
                        text = sibling.textContent.trim();
                        if (text.length > 0) break;
                    }
                }
                if (text.length > 0) break;
                parent = parent.parentElement;
            }
        }

        texts.push(text.substring(0, 500)); // Limit to 500 chars
    });

    return texts;
}

async function handleTwitterUrl(url) {
    // Extract tweet ID from URL
    const tweetIdMatch = url.match(/\/status\/(\d+)/);
    if (!tweetIdMatch) {
        throw new Error('有効なツイートURLではありません');
    }

    // Try to use oEmbed API
    try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        const data = await response.json();

        // Extract image from HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.html, 'text/html');
        const images = doc.querySelectorAll('img');

        currentState.images = [];
        images.forEach((img) => {
            const src = img.src;
            if (src && !src.includes('pbs.twimg.com/profile_images')) {
                currentState.images.push(src);
            }
        });

        // Get text from tweet
        const tweetText = data.html.match(/>([^<]+)</);
        currentState.texts = [tweetText ? tweetText[1].trim() : 'ツイート'];

        if (currentState.images.length === 0) {
            throw new Error('このツイートに画像が見つかりませんでした');
        }
    } catch (err) {
        throw new Error('ツイートの読み込みに失敗しました。公開ツイートのURLをお試しください。');
    }
}

async function handleInstagramUrl(url) {
    // Instagram requires more complex handling due to CORS restrictions
    // For now, we'll show a helpful message
    throw new Error('Instagramの対応は準備中です。WebページやXのポストをお試しください。');
}

function displayContent() {
    if (currentState.images.length === 0) {
        throw new Error('表示する画像が見つかりませんでした');
    }

    currentState.currentIndex = 0;
    content.classList.remove('hidden');
    showImage(0);
}

function showImage(index) {
    if (index < 0 || index >= currentState.images.length) {
        return;
    }

    currentState.currentIndex = index;
    mainImage.src = currentState.images[index];
    textContent.textContent = currentState.texts[index] || '（テキストなし）';
    sourceLink.href = currentState.originalUrl;
    sourceLink.textContent = currentState.originalUrl.substring(0, 50) + (currentState.originalUrl.length > 50 ? '...' : '');

    // Update navigation
    if (currentState.images.length > 1) {
        imageNav.classList.remove('hidden');
        imageCount.textContent = `${index + 1} / ${currentState.images.length}`;
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === currentState.images.length - 1;
    } else {
        imageNav.classList.add('hidden');
    }
}

function showPrevImage() {
    if (currentState.currentIndex > 0) {
        showImage(currentState.currentIndex - 1);
    }
}

function showNextImage() {
    if (currentState.currentIndex < currentState.images.length - 1) {
        showImage(currentState.currentIndex + 1);
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add('show');
}

function hideError() {
    errorMsg.classList.remove('show');
}
