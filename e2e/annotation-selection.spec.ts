import { expect, test, type Page } from '@playwright/test';

type StoredArticle = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  titleUrl?: string;
};

type StoredAnnotation = {
  id: string;
  articleId: string;
  text: string;
  comment: string;
  color: string;
  startOffset: number;
  endOffset: number;
  createdAt: string;
  updatedAt: string;
};

const ARTICLE: StoredArticle = {
  id: 'article-e2e-selection-bug',
  title: 'Тестовая статья для e2e',
  content:
    'Кремль приветствует любые формы реанимации диалога с США, заявил пресс-секретарь президента России Дмитрий Песков, отвечая на вопрос об идее отправить делегацию депутатов Госдумы в Соединенные Штаты, сообщает корреспондент РБК.',
  createdAt: '2026-03-25T12:00:00.000Z',
  updatedAt: '2026-03-25T12:00:00.000Z',
};

const REAL_ARTICLE: StoredArticle = {
  id: '2abe099e-2dfd-4b15-a7af-3ccddc05cb0d',
  title: 'Россиян начали обманывать с помощью подписки на сериалы за 10 руб',
  titleUrl: 'https://s0.rbk.ru/v6_top_pics/resized/600xH/media/img/2/45/347742043889452.webp',
  content:
    'Мошенники начали создавать сайты, где предлагают «подписку» на фильмы и сериалы за 10–12 руб., но после оплаты у пользователей начинают списываться крупные суммы, рассказали РБК в компании-разработчике технологий для борьбы с киберугрозами F6. Ее специалисты обнаружили более 1200 доменов сайтов, которые выдают себя за онлайн-кинотеатры.\n\nЗлоумышленники маскируются под пиратские ресурсы, но формально выглядят как добропорядочный сервис: у них есть пользовательское соглашение, в котором указаны условия подписки. Такие сайты обещают пользователям бесплатный доступ к контенту, который защищен авторскими правами. Прежде чем завести пользователя в ловушку, мошенники проводят его через один или несколько промежуточных сайтов. После запуска плеера с выбранным фильмом на экране высвечивается надпись: «Для продолжения просмотра требуется регистрация».\n\n«После того как пользователь вводит номер телефона, происходит переадресация на страницу оплаты, на которой для оформления подписки предлагают заплатить 10–12 руб. Никаких дополнительных пояснений перед оплатой не приводится», — указывают в F6.\n\nМошенники в своей схеме используют автопродление и в итоге у пользователей помимо 10 руб. за «пробный период» списывают 360 руб. каждую неделю, в месяц это обходится в 1,5 тыс. руб.\n\nВ F6 советуют не оформлять подписку на сомнительных сайтах, использовать для оплаты онлайн-сервисов отдельные банковские карты с лимитом на списание и смотреть кино на легальных сервисах.',
  createdAt: '2026-03-25T10:52:05.804Z',
  updatedAt: '2026-03-25T15:45:53.392Z',
};

const TARGET_TEXT = 'диалога с США,';
const EXISTING_ANNOTATION_TEXT = 'явил пресс-секретарь президента России Дмитрий Песков';
const EXISTING_ANNOTATION_START = ARTICLE.content.indexOf(EXISTING_ANNOTATION_TEXT);
const SPECIALISTS_TEXT = 'специалисты';

const EXISTING_ANNOTATION: StoredAnnotation = {
  id: 'annotation-e2e-existing',
  articleId: ARTICLE.id,
  text: EXISTING_ANNOTATION_TEXT,
  comment: 'Существующая аннотация',
  color: 'rgba(244, 186, 70, 0.45)',
  startOffset: EXISTING_ANNOTATION_START,
  endOffset: EXISTING_ANNOTATION_START + EXISTING_ANNOTATION_TEXT.length,
  createdAt: '2026-03-25T12:00:00.000Z',
  updatedAt: '2026-03-25T12:00:00.000Z',
};

const REAL_ARTICLE_ANNOTATIONS: StoredAnnotation[] = [
  {
    id: 'fbf63e3b-6096-4de8-88b4-5dda9c7ed429',
    articleId: REAL_ARTICLE.id,
    text: 'Мошенники начали создавать сайты, где предлагают «подписку» на фильмы и сериалы за 10–12 руб.',
    comment: 'жуть',
    color: 'rgba(235, 127, 132, 0.4)',
    startOffset: 0,
    endOffset: 93,
    createdAt: '2026-03-25T11:30:10.682Z',
    updatedAt: '2026-03-25T13:42:09.094Z',
  },
  {
    id: '0f70cfda-0820-4795-82aa-bb01be78fb87',
    articleId: REAL_ARTICLE.id,
    text: 'выбранным фильмом на экране высвечивается надпись: «Для продолжения просмотра требуется регистрация».\n\n',
    comment: 'Розовый цвет',
    color: 'rgba(126, 195, 134, 0.42)',
    startOffset: 752,
    endOffset: 855,
    createdAt: '2026-03-25T14:19:30.717Z',
    updatedAt: '2026-03-25T14:19:30.717Z',
  },
  {
    id: 'aee7986f-595a-413b-9c7c-b447b5aa1fb6',
    articleId: REAL_ARTICLE.id,
    text: 'льское соглашение, в котором указаны у',
    comment: '777',
    color: 'rgba(115, 168, 243, 0.38)',
    startOffset: 461,
    endOffset: 499,
    createdAt: '2026-03-25T14:23:14.405Z',
    updatedAt: '2026-03-25T14:23:14.405Z',
  },
  {
    id: '7cd01870-df8d-4300-a987-4834c620b8fa',
    articleId: REAL_ARTICLE.id,
    text: 'ают в F6.\n\nМошенники в своей схеме используют автопродление и в и',
    comment: 'ггг',
    color: 'rgba(235, 127, 132, 0.4)',
    startOffset: 1090,
    endOffset: 1155,
    createdAt: '2026-03-25T14:23:31.342Z',
    updatedAt: '2026-03-25T14:23:31.342Z',
  },
];

async function seedArticle(page: Page, article: StoredArticle, annotations: StoredAnnotation[]) {
  await page.addInitScript(
    ({ nextArticle, nextAnnotations }) => {
      localStorage.clear();
      localStorage.setItem('text-annotator.articles', JSON.stringify([nextArticle]));
      localStorage.setItem('text-annotator.annotations', JSON.stringify(nextAnnotations));
    },
    { nextArticle: article, nextAnnotations: annotations },
  );
}

async function selectTextInArticle(page: Page, targetText: string) {
  await page.evaluate((textToSelect) => {
    const container = document.querySelector<HTMLElement>('.article-content');

    if (!container) {
      throw new Error('Expected the article content container.');
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let matchedNode: Text | null = null;

    while (walker.nextNode()) {
      const currentNode = walker.currentNode as Text;
      const parentElement = currentNode.parentElement;

      if (!parentElement?.classList.contains('article-content__segment')) {
        continue;
      }

      if ((currentNode.textContent ?? '').includes(textToSelect)) {
        matchedNode = currentNode;
        break;
      }
    }

    if (!matchedNode) {
      throw new Error(`Unable to find "${textToSelect}" in the rendered article.`);
    }

    const fullText = matchedNode.textContent ?? '';
    const startOffset = fullText.indexOf(textToSelect);

    if (startOffset === -1) {
      throw new Error(`Unable to find "${textToSelect}" inside the matched text node.`);
    }

    const range = document.createRange();
    range.setStart(matchedNode, startOffset);
    range.setEnd(matchedNode, startOffset + textToSelect.length);

    const selection = window.getSelection();

    if (!selection) {
      throw new Error('window.getSelection() is unavailable.');
    }

    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, targetText);
}

test.describe('Article annotation selection', () => {
  test('preserves the exact selected text next to an existing annotation', async ({ page }) => {
    await seedArticle(page, ARTICLE, [EXISTING_ANNOTATION]);

    await page.goto(`/articles/${ARTICLE.id}`);
    await expect(page.locator('.article-content')).toBeVisible();
    await selectTextInArticle(page, TARGET_TEXT);

    await page.getByRole('button', { name: 'Да, добавить' }).click();

    await expect(page.locator('.annotation-form__preview blockquote')).toHaveText(TARGET_TEXT);
  });

  test('keeps the full word "специалисты" for article 2abe099e-2dfd-4b15-a7af-3ccddc05cb0d', async ({ page }) => {
    await seedArticle(page, REAL_ARTICLE, REAL_ARTICLE_ANNOTATIONS);

    await page.goto(`/articles/${REAL_ARTICLE.id}`);
    await expect(page.locator('.article-content')).toBeVisible();

    await selectTextInArticle(page, SPECIALISTS_TEXT);
    await expect(page.getByText('Добавить аннотацию к выделенному фрагменту?')).toBeVisible();

    await page.getByRole('button', { name: 'Да, добавить' }).click();

    await expect(page.locator('.annotation-form__preview blockquote')).toHaveText(SPECIALISTS_TEXT);
  });
});
