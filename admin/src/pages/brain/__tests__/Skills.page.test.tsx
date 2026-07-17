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

// brain-resident 分支（get_skill 带 source_id）返回的形态：无 frontmatter。
const RESIDENT_SKILL_DETAIL = {
  source_id: 'wiki',
  pack_name: 'wiki-pack',
  slug: 'wiki-ingest',
  description: 'Ingest wiki pages into the brain.',
  body: 'Resident pack skill body rendered in the drawer.',
};

function renderSkills() {
  return render(
    <WhyProvider>
      <Skills />
    </WhyProvider>,
  );
}

beforeEach(() => {
  // 每个用例从干净 hash 起步（页面会把 filter 写回 URL，避免跨用例泄漏）。
  window.location.hash = '';
  callMcp.mockReset();
  callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
    if (name === 'list_skills') return Promise.resolve({ skills: SKILLS });
    if (name === 'list_brain_skillpack') return Promise.resolve({ packs: PACKS });
    if (name === 'get_skill') {
      return Promise.resolve(args?.source_id ? RESIDENT_SKILL_DETAIL : GET_SKILL_RESULT);
    }
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

describe('Skills data-testid', () => {
  it('搜索框/网格均带 data-testid', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    expect(screen.getByTestId('skills-search')).toBeInTheDocument();
    expect(screen.getByTestId('skills-grid')).toBeInTheDocument();
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

  it('点击 pack skill 打开抽屉并带 source_id 拉 brain-resident 正文', async () => {
    renderSkills();
    fireEvent.click(await screen.findByText('wiki-ingest'));
    expect(await screen.findByText(/Resident pack skill body/)).toBeInTheDocument();
    // get_skill 必须带 source_id 才会走 brain-resident 分支。
    expect(callMcp).toHaveBeenCalledWith('get_skill', { name: 'wiki-ingest', source_id: 'wiki' });
  });
});

describe('Skills filter URL 持久化', () => {
  it('从 #/skills?section=meta 初始化只显示 meta 分类', async () => {
    window.location.hash = '#/skills?section=meta';
    renderSkills();
    await screen.findByText('skillify');
    expect(screen.queryByText('idea-ingest')).not.toBeInTheDocument();
  });

  it('从 #/skills?q=... 初始化预填搜索并过滤', async () => {
    window.location.hash = '#/skills?q=skillify';
    renderSkills();
    await screen.findByText('skillify');
    expect(screen.queryByText('idea-ingest')).not.toBeInTheDocument();
    expect(screen.getByTestId('skills-search')).toHaveValue('skillify');
  });

  it('点击分类 pill 把 section 写回 URL hash', async () => {
    renderSkills();
    await screen.findByText('idea-ingest');
    const filterGroup = screen.getByRole('group', { name: '按分类过滤' });
    fireEvent.click(within(filterGroup).getByText('meta'));
    expect(window.location.hash).toContain('section=meta');
  });
});

describe('Skills 渐进渲染', () => {
  const MANY = Array.from({ length: 65 }, (_, i) => ({
    name: `skill-${String(i).padStart(3, '0')}`,
    description: 'bulk skill for progressive rendering.',
    section: 'ingest',
    triggers: [],
    tools: [],
    usable_tools: [],
    unavailable_tools: [],
    writes_pages: false,
    mutating: false,
  }));

  beforeEach(() => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_skills') return Promise.resolve({ skills: MANY });
      if (name === 'list_brain_skillpack') return Promise.resolve({ packs: [] });
      return Promise.resolve({});
    });
  });

  it('超过渲染上限时只渲染首批并提供「显示更多」', async () => {
    renderSkills();
    expect(await screen.findByText('skill-000')).toBeInTheDocument();
    // 上限 60：第 61 张（索引 060）初始不渲染。
    expect(screen.queryByText('skill-060')).not.toBeInTheDocument();
    expect(screen.getByTestId('skills-load-more')).toBeInTheDocument();
  });

  it('点击「显示更多」放出下一批', async () => {
    renderSkills();
    await screen.findByText('skill-000');
    fireEvent.click(screen.getByTestId('skills-load-more'));
    expect(screen.getByText('skill-064')).toBeInTheDocument();
    // 全部放完后按钮消失。
    expect(screen.queryByTestId('skills-load-more')).not.toBeInTheDocument();
  });
});
