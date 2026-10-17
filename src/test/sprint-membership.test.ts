import { sprints, tasks } from '@/test/fixtures/mockData'
import { describe, expect, it } from 'vitest'

describe('sprint membership', () => {
  it('derives membership exclusively from Task.sprintId', () => {
    const sprint = sprints.find((item) => item.id === 's1')!
    const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id)

    expect(sprintTasks.map((task) => task.id)).toContain('t1')
    expect(sprintTasks.map((task) => task.id)).not.toContain('t13')
    expect(tasks.find((task) => task.id === 't13')?.sprintId).toBeUndefined()
  })
})
