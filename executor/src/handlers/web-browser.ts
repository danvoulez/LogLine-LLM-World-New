import puppeteer from 'puppeteer';

interface WebBrowserInput {
  action: 'navigate' | 'screenshot' | 'content' | 'click' | 'type';
  url?: string;
  selector?: string;
  text?: string;
}

export async function handleWebBrowser(input: WebBrowserInput): Promise<{ title?: string; content?: string; screenshot?: string; error?: string; message?: string }> {
  const { action, url, selector, text } = input;
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Set viewport to a standard desktop resolution
    await page.setViewport({ width: 1280, height: 800 });

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    let result: any = {};

    switch (action) {
      case 'navigate':
        result.title = await page.title();
        result.content = await page.content();
        break;
      case 'content':
        result.content = await page.content();
        break;
      case 'screenshot':
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        result.screenshot = screenshot;
        break;
      case 'click':
        if (selector) {
          await page.click(selector);
          result.message = `Clicked on ${selector}`;
        } else {
          throw new Error('Selector required for click action');
        }
        break;
      case 'type':
        if (selector && text) {
          await page.type(selector, text);
          result.message = `Typed "${text}" into ${selector}`;
        } else {
          throw new Error('Selector and text required for type action');
        }
        break;
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return result;
  } catch (error: any) {
    return { error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
