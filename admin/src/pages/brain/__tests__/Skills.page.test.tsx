import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const callMcp = vi.fn();
vi.mock('../../../lib/mcp-client', () => ({
  callMcp: (...args: unknown[]) => callMcp(...args),
  buildMcpRequest: vi.fn(),
  parseMcpPayload: vi.fn(),
  setMcpToken: vi.fn(),
  hasMcpToken: vi.fn(() => false),
}));

import { Skills } from '../Skills';
import { WhyProvider } from '../../../components/brain/WhyProvider';

const SKILLS = [
  {
    name: 'idea-ingest',
    description: 'Capture nascent ideas with timestamp + source attribution.',
    section: 'ingest',
    triggers: ['got an idea', 'save this idea'],
    tools: ['file_upload', 'classify'],
    usable_tools: ['file_upload', 'classify'],
    unavailable_tools: [],
    writes_pages: false,
    mutating: false,
  },
  {
    name: 'skillify',
    description: 'Turn any raw feature into a properly-skilled, tested, resolvable unit.',
    section: 'meta',
    triggers: ['skillify this'],
    tools: ['file_write', 'run_tests', 'git_commit'],
    usable_tools: ['file_write'],
    unavailable_tools: ['run_tests', 'git_commit'],
    writes_pages: true,
    mutating: true,
  },
];

const PACKS = [
  {
    source_id: 'wiki',
    name: 'wiki-pack',
    version: '1.2.0',
    schema_pack: 'wiki-schema',
    active_schema_pack: 'wiki-schema',
    schema_pack_match: true,
    skills: [{ slug: 'wiki-ingest', description: 'Ingest wiki pages into the brain.' }],
    scaffold_spec: 'github:acme-example/wiki-pack#v1.2.0',
    installed: true,
  },
];

const GET_SKILL_RESULT = {
  schema_version: 1,
  name: 'idea-ingest',
  frontmatter: {
    name: 'idea-ingest',
    description: 'Capture nascent ideas with timestamp + source attribution.',
    triggers: ['got an idea'],
    tools: ['file_upload'],
    writes_pages: false,
    mutating: false,
  },
  body: 'Full skill instructions live here for the drawer to render.',
  usable_tools: ['file_upload'],
  unavailable_tools: [],
  client_guidance: {
    nature: 'prose skill',
    protocol: ['fetch', 'follow'],
    available_brain_tools: ['file_upload'],
    mutating: false,
  },
};

function renderSkills() {
  return render(
    <WhyProvider>
      <Skills />
    </WhyProvider>,
  );
}

beforeEach(() => {
  callMcp.mockReset();
  callMcp.mockImplementation((name: string) => {
    if (name === 'list_skills') return Promise.resolve({ skills: SKILLS });
    if (name === 'list_brain_skillpack') return Promise.resolve({ packs: PACKS });
    if (name === 'get_skill') return Promise.resolve(GET_SKILL_RESULT);
    return Promise.resolve({});
  });
});

describe('Skills 页面基础渲染', () => {
  it('渲染两个 skill 卡片', async () => {
    renderSkills();
    expect(await screen.findByText('idea-ingest')).toBeInTheDocument();
    expect(screen.getByText('skillify')).toBeInTheDocument();
  });

  it('大标题显示 skill 数与分类数', async () => {
    renderSkills();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('2 个 skill · 2 个分类');
  });
});

describe('Skills 搜索', () => {
  it('按名称过滤', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    fireEvent.change(screen.getByPlaceholderText('搜索 skill 名 / 描述 / trigger…'), {
      target: { value: 'skillify' },
    });
    expect(screen.queryByText('idea-ingest')).not.toBeInTheDocument();
    expect(screen.getByText('skillify')).toBeInTheDocument();
  });

  it('按 trigger 过滤', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    fireEvent.change(screen.getByPlaceholderText('搜索 skill 名 / 描述 / trigger…'), {
      target: { value: 'save this idea' },
    });
    expect(screen.getByText('idea-ingest')).toBeInTheDocument();
    expect(screen.queryByText('skillify')).not.toBeInTheDocument();
  });

  it('无匹配时显示空态', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    fireEvent.change(screen.getByPlaceholderText('搜索 skill 名 / 描述 / trigger…'), {
      target: { value: 'zzz-nomatch' },
    });
    expect(screen.getByText('无匹配技能。')).toBeInTheDocument();
  });
});

describe('Skills 分类过滤', () => {
  it('渲染分类 pill 含计数', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    expect(screen.getByText('all')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('点击 meta pill 只显示 meta 分类', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    const filterGroup = screen.getByRole('group', { name: '按分类过滤' });
    fireEvent.click(within(filterGroup).getByText('meta'));
    expect(screen.queryByText('idea-ingest')).not.toBeInTheDocument();
    expect(screen.getByText('skillify')).toBeInTheDocument();
  });

  it('分类 pill 含色点', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    const filterGroup = screen.getByRole('group', { name: '按分类过滤' });
    const dots = filterGroup.querySelectorAll('span[aria-hidden]');
    // all + ingest + meta = 3 pills, 'all' 无色点 → 2 个色点
    expect(dots.length).toBe(2);
  });
});

describe('Skills 工具可用性', () => {
  it('渲染 usable/total 工具计数', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    expect(screen.getByText('工具 2/2 可用')).toBeInTheDocument();
    expect(screen.getByText('工具 1/3 可用')).toBeInTheDocument();
  });

  it('工具过多时只预览前几项并以省略行收尾', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_skills') {
        return Promise.resolve({
          skills: [
            {
              name: 'schema-author',
              description: 'Evolve schema pack.',
              section: 'meta',
              triggers: [],
              tools: ['gbrain schema explain', 'gbrain schema list', 'gbrain schema types', 'gbrain schema follow', 'gbrain schema sync'],
              usable_tools: ['gbrain schema explain', 'gbrain schema list', 'gbrain schema types', 'gbrain schema follow', 'gbrain schema sync'],
              unavailable_tools: [],
              writes_pages: false,
              mutating: false,
            },
          ],
        });
      }
      if (name === 'list_brain_skillpack') return Promise.resolve({ packs: [] });
      return Promise.resolve({});
    });
    renderSkills();
    await screen.findByText('schema-author');
    expect(screen.getByText('explain')).toBeInTheDocument();
    expect(screen.getByText('list')).toBeInTheDocument();
    expect(screen.getByText('types')).toBeInTheDocument();
    expect(screen.getByText('follow')).toBeInTheDocument();
    expect(screen.queryByText('sync')).not.toBeInTheDocument();
    expect(screen.getAllByText('.')).toHaveLength(3);
  });

  it('有受限工具时显示受限数量', async () => {
    renderSkills();
    await screen.findByText('skillify');
    expect(screen.getByText('· 2 个受限')).toBeInTheDocument();
  });
});

describe('Skills 工具栏 Skillify 按钮', () => {
  it('点击打开 Why 面板', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    fireEvent.click(screen.getByRole('button', { name: 'Skillify' }));
    expect(screen.getByText('为什么 Skillify 是 11 项 checklist · 不是一个文件？')).toBeInTheDocument();
  });
});

describe('Skills data-testid', () => {
  it('搜索框/网格/Skillify 按钮均带 data-testid', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    expect(screen.getByTestId('skills-search')).toBeInTheDocument();
    expect(screen.getByTestId('skills-grid')).toBeInTheDocument();
    expect(screen.getByTestId('skillify-button')).toBeInTheDocument();
  });
});

describe('Skills 详情抽屉', () => {
  it('点击卡片打开详情抽屉并展示 get_skill 正文', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    fireEvent.click(screen.getByText('idea-ingest'));
    expect(await screen.findByText(/Full skill instructions live here/)).toBeInTheDocument();
  });
});

describe('Skills Skillpack 区块', () => {
  it('渲染 list_brain_skillpack 返回的 pack', async () => {
    renderSkills();
    expect(await screen.findByText('wiki-pack')).toBeInTheDocument();
    expect(screen.getByText(/gbrain skillpack scaffold github:acme-example\/wiki-pack#v1\.2\.0/)).toBeInTheDocument();
  });
});
