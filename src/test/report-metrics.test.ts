import { describe, expect, it } from 'vitest'
import { members, sprints, tasks } from '@/test/fixtures/mockData'
import { baseTaskStatuses } from '@/config/taskStatus'
import { buildBurndownReport, buildControlChartReport, buildCreatedResolvedReport, buildCumulativeFlowReport, buildVelocityReport } from '@/utils/reportMetrics'

const projectTasks = tasks.filter((task) => task.projectId === 'p1')
const projectSprints = sprints.filter((sprint) => sprint.projectId === 'p1')
const builtInTerminalStatusIds = ['done']

describe('report-specific metrics', () => {
  it('keeps an empty project free of synthetic report series', () => {
    expect(buildBurndownReport([], [], builtInTerminalStatusIds).data).toEqual([])
    expect(buildVelocityReport([], [], builtInTerminalStatusIds).rows).toEqual([])
    expect(buildCumulativeFlowReport([], baseTaskStatuses, builtInTerminalStatusIds).data).toEqual([])
  })

  it('does not fabricate Burndown history from current sprint tasks', () => {
    const report = buildBurndownReport(projectTasks, projectSprints, builtInTerminalStatusIds)
    expect(report.data).toEqual([])
    expect(report.metrics.find((metric) => metric.label === 'نقاط تاریخی')?.value).toBe(0)
  })

  it('does not create Velocity rows when no completed sprints exist', () => {
    const report = buildVelocityReport(projectTasks, [], builtInTerminalStatusIds)
    expect(report.rows).toEqual([])
    expect(report.metrics.find((metric) => metric.label === 'میانگین Velocity')?.value).toBe(0)
  })

  it('uses an actual completed sprint for Velocity when authoritative sprint data exists', () => {
    const completedSprint = { ...projectSprints[0], status: 'completed' as const }
    const report = buildVelocityReport(projectTasks, [completedSprint], builtInTerminalStatusIds)
    expect(report.rows.map((row) => row.sprint)).toEqual([completedSprint.name])
    expect(report.rows[0]).toMatchObject({ committed: expect.any(Number), completed: expect.any(Number) })
  })

  it('does not fabricate Cumulative Flow history from current status counts', () => {
    const report = buildCumulativeFlowReport([], baseTaskStatuses, builtInTerminalStatusIds)
    expect(report.areas.map((area) => area.key)).toEqual(baseTaskStatuses.map((status) => status.id))
    expect(report.data).toEqual([])
  })

  it('builds Control Chart cycle-time points rather than Burndown series', () => {
    const report = buildControlChartReport(projectTasks, members, builtInTerminalStatusIds)
    expect(report.rows.every((row) => row.cycleTime >= 1)).toBe(true)
    expect(report.rows[0]).toHaveProperty('assignee')
    expect(report).not.toHaveProperty('data')
  })

  it('builds independent Created and Resolved temporal series', () => {
    const report = buildCreatedResolvedReport(projectTasks, builtInTerminalStatusIds)
    expect(report.data.length).toBeGreaterThan(0)
    expect(report.data[0]).toMatchObject({ created: expect.any(Number), resolved: expect.any(Number) })
    expect(report.metrics.map((metric) => metric.label)).toEqual(['ایجادشده', 'حل‌شده', 'تغییر خالص', 'نسبت حل'])
  })

  it('counts only the supplied custom terminal status and never fabricates done completion', () => {
    const customTasks = [
      { ...projectTasks[0], id: 'release', status: 'release-x', storyPoints: 5 },
      { ...projectTasks[1], id: 'literal-done', status: 'done', storyPoints: 3 },
    ]
    const report = buildBurndownReport(customTasks, [], ['release-x'])

    expect(report.metrics).toContainEqual({ label: 'کار باقی‌مانده', value: 3 })
    expect(buildControlChartReport(customTasks, members, ['release-x']).rows.map((row) => row.id)).toEqual(['release'])
    expect(buildCreatedResolvedReport(customTasks, []).metrics).toContainEqual({ label: 'حل‌شده', value: 0 })
  })

  it('keeps all work unfinished when a project has no terminal mapping', () => {
    const report = buildBurndownReport([{ ...projectTasks[0], status: 'done', storyPoints: 5 }], [], [])

    expect(report.metrics).toContainEqual({ label: 'کار باقی‌مانده', value: 5 })
    expect(buildCumulativeFlowReport([{ ...projectTasks[0], status: 'done' }], baseTaskStatuses, []).metrics).toContainEqual({ label: 'انجام‌شده', value: 0 })
  })
})
