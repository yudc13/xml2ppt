CREATE TABLE IF NOT EXISTS "ppt_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "cover_url" text,
  "scene_tag" text NOT NULL,
  "lang" text NOT NULL DEFAULT 'zh-CN',
  "ratio" text NOT NULL DEFAULT '16:9',
  "is_free" boolean NOT NULL DEFAULT true,
  "status" text NOT NULL DEFAULT 'active',
  "sort_order" integer NOT NULL DEFAULT 0,
  "template_data" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ppt_template_slug_unique" UNIQUE ("slug"),
  CONSTRAINT "ppt_template_status_check" CHECK ("status" IN ('active', 'inactive')),
  CONSTRAINT "ppt_template_ratio_check" CHECK ("ratio" = '16:9'),
  CONSTRAINT "ppt_template_lang_check" CHECK ("lang" = 'zh-CN')
);

CREATE INDEX IF NOT EXISTS "idx_ppt_template_status_sort"
  ON "ppt_template" ("status", "sort_order");
CREATE INDEX IF NOT EXISTS "idx_ppt_template_scene_tag"
  ON "ppt_template" ("scene_tag");

INSERT INTO "ppt_template" (
  "title", "slug", "cover_url", "scene_tag", "template_data", "sort_order"
) VALUES
  (
    '年度工作总结',
    'annual-work-summary',
    null,
    '工作汇报',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-annual-summary-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-annual-summary-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-annual-summary-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    1
  ),
  (
    '季度复盘汇报',
    'quarterly-review-report',
    null,
    '工作汇报',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-quarterly-review-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-quarterly-review-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-quarterly-review-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    2
  ),
  (
    '项目启动方案',
    'project-kickoff-plan',
    null,
    '项目管理',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-project-kickoff-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-project-kickoff-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-project-kickoff-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    3
  ),
  (
    '产品发布路演',
    'product-launch-roadshow',
    null,
    '产品运营',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-product-launch-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-product-launch-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-product-launch-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    4
  ),
  (
    '市场分析报告',
    'market-analysis-report',
    null,
    '市场营销',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-market-analysis-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-market-analysis-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-market-analysis-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    5
  ),
  (
    '培训课程课件',
    'training-course-deck',
    null,
    '教育培训',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-training-course-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-training-course-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-training-course-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    6
  ),
  (
    '融资路演模板',
    'fundraising-pitch-deck',
    null,
    '融资路演',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-fundraising-pitch-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-fundraising-pitch-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-fundraising-pitch-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    7
  ),
  (
    '团队介绍模板',
    'team-introduction-template',
    null,
    '团队介绍',
    '{"slides":[{"position":1,"xmlContent":"<slide id=\"tpl-team-introduction-cover\"><style><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></style><data><shape id=\"tpl-team-introduction-bg\" type=\"rect\" width=\"960\" height=\"540\" topLeftX=\"0\" topLeftY=\"0\" rotation=\"0\"><fill><fillColor color=\"rgba(252, 252, 252, 1)\"/></fill></shape></data><note id=\"tpl-team-introduction-note\"><content><p></p></content></note></slide>"}]}'::jsonb,
    8
  )
ON CONFLICT ("slug") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "scene_tag" = EXCLUDED."scene_tag",
  "template_data" = EXCLUDED."template_data",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();
