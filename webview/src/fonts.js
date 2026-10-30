/**
 * Fonts for the Vetch SVG editor's text tool. Scratch's own fonts only exist inside Scratch, so the text tool
 * offers common fonts instead, showing only the ones installed on this computer. Each one falls back to a similar
 * generic font, so the text still shows up on computers that don't have it.
 */

const FONT_CHOICES = [
    { name: 'Arial', family: 'Arial, Helvetica, sans-serif' },
    { name: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
    { name: 'Trebuchet MS', family: '\'Trebuchet MS\', sans-serif' },
    { name: 'Georgia', family: 'Georgia, serif' },
    { name: 'Times New Roman', family: '\'Times New Roman\', Times, serif' },
    { name: 'Courier New', family: '\'Courier New\', Courier, monospace' },
    { name: 'Comic Sans MS', family: '\'Comic Sans MS\', cursive' },
    { name: 'Impact', family: 'Impact, sans-serif' },
    { name: 'Brush Script MT', family: '\'Brush Script MT\', cursive' },
    { name: '中文', family: '\'PingFang SC\', \'Microsoft YaHei\', \'Noto Sans CJK SC\', sans-serif' },
    { name: '日本語', family: '\'Hiragino Sans\', \'Hiragino Kaku Gothic ProN\', \'Yu Gothic\', Meiryo, \'Noto Sans CJK JP\', sans-serif' },
    { name: '한국어', family: '\'Apple SD Gothic Neo\', \'Malgun Gothic\', \'Noto Sans CJK KR\', sans-serif' }
];
// Used if none of the fonts above are installed
const FALLBACK_FONT = { name: 'Sans Serif', family: 'sans-serif' };

const GENERIC_FAMILIES = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
const TEST_TEXT = 'mmmmmmmmmmlli10OQ@#中文日本語한국어';

let measuringContext = null;

/**
 * Check whether a font is installed: text drawn in it is a different width than in the fallback fonts.
 */
function isInstalled(family) {
    try {
        measuringContext = measuringContext || document.createElement('canvas').getContext('2d');
        return ['monospace', 'serif', 'sans-serif'].some(fallback => {
            measuringContext.font = `72px ${fallback}`;
            const fallbackWidth = measuringContext.measureText(TEST_TEXT).width;
            measuringContext.font = `72px ${family}, ${fallback}`;
            return measuringContext.measureText(TEST_TEXT).width !== fallbackWidth;
        });
    } catch (e) {
        return true;
    }
}

function getFamilyNames(family) {
    return family.split(',').map(name => name.trim().replace(/^['"]|['"]$/g, ''));
}

function isAvailable(font) {
    return getFamilyNames(font.family)
        .filter(name => !GENERIC_FAMILIES.includes(name))
        .some(name => isInstalled(`'${name}'`));
}

const availableFonts = FONT_CHOICES.filter(isAvailable);

/**
 * The text tool's fonts, in menu order: each has a name to show and the font family used for the text.
 */
export const FONTS = availableFonts.length > 0 ? availableFonts : [FALLBACK_FONT];
export const DEFAULT_FONT = FONTS[0].family;

/**
 * Get the name to show for a font family, e.g. "Arial" for "Arial, Helvetica, sans-serif". Fonts that aren't in
 * the menu (from an imported SVG) show their first family name.
 */
export function getFontName(family) {
    if (!family) return '';
    const font = [...FONT_CHOICES, FALLBACK_FONT].find(choice => choice.family === family);
    return font ? font.name : getFamilyNames(family)[0];
}

// Font families by name, like scratch-paint's font list
const Fonts = Object.fromEntries(FONTS.map(font => [font.name, font.family]));

export default Fonts;
