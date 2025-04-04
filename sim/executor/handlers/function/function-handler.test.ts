import '../../__test-utils__/mock-dependencies'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { BlockOutput } from '@/blocks/types'
import { SerializedBlock } from '@/serializer/types'
import { executeTool } from '@/tools'
import { ExecutionContext } from '../../types'
import { FunctionBlockHandler } from './function-handler'

const mockExecuteTool = executeTool as Mock

describe('FunctionBlockHandler', () => {
  let handler: FunctionBlockHandler
  let mockBlock: SerializedBlock
  let mockContext: ExecutionContext

  beforeEach(() => {
    handler = new FunctionBlockHandler()

    mockBlock = {
      id: 'func-block-1',
      metadata: { id: 'function', name: 'Test Function' },
      position: { x: 30, y: 30 },
      config: { tool: 'function', params: {} },
      inputs: { code: 'string', timeout: 'number' }, // Using ParamType strings
      outputs: {},
      enabled: true,
    }

    mockContext = {
      workflowId: 'test-workflow-id',
      blockStates: new Map(),
      blockLogs: [],
      metadata: {},
      environmentVariables: {},
      decisions: { router: new Map(), condition: new Map() },
      loopIterations: new Map(),
      loopItems: new Map(),
      executedBlocks: new Set(),
      activeExecutionPath: new Set(),
    }

    // Reset mocks using vi
    vi.clearAllMocks()

    // Default mock implementation for executeTool
    mockExecuteTool.mockResolvedValue({ success: true, output: { result: 'Success' } })
  })

  it('should handle function blocks', () => {
    expect(handler.canHandle(mockBlock)).toBe(true)
    const nonFuncBlock: SerializedBlock = { ...mockBlock, metadata: { id: 'other' } }
    expect(handler.canHandle(nonFuncBlock)).toBe(false)
  })

  it('should execute function block with string code', async () => {
    const inputs = {
      code: 'console.log("Hello"); return 1 + 1;',
      timeout: 10000,
    }
    const expectedToolParams = {
      code: inputs.code,
      timeout: inputs.timeout,
      _context: { workflowId: mockContext.workflowId },
    }
    const expectedOutput: BlockOutput = { response: { result: 'Success' } }

    const result = await handler.execute(mockBlock, inputs, mockContext)

    expect(mockExecuteTool).toHaveBeenCalledWith('function_execute', expectedToolParams)
    expect(result).toEqual(expectedOutput)
  })

  it('should execute function block with array code', async () => {
    const inputs = {
      code: [{ content: 'const x = 5;' }, { content: 'return x * 2;' }],
      timeout: 5000,
    }
    const expectedCode = 'const x = 5;\nreturn x * 2;'
    const expectedToolParams = {
      code: expectedCode,
      timeout: inputs.timeout,
      _context: { workflowId: mockContext.workflowId },
    }
    const expectedOutput: BlockOutput = { response: { result: 'Success' } }

    const result = await handler.execute(mockBlock, inputs, mockContext)

    expect(mockExecuteTool).toHaveBeenCalledWith('function_execute', expectedToolParams)
    expect(result).toEqual(expectedOutput)
  })

  it('should use default timeout if not provided', async () => {
    const inputs = { code: 'return true;' }
    const expectedToolParams = {
      code: inputs.code,
      timeout: 5000, // Default timeout
      _context: { workflowId: mockContext.workflowId },
    }

    await handler.execute(mockBlock, inputs, mockContext)

    expect(mockExecuteTool).toHaveBeenCalledWith('function_execute', expectedToolParams)
  })

  it('should handle execution errors from the tool', async () => {
    const inputs = { code: 'throw new Error("Code failed");' }
    const errorResult = { success: false, error: 'Function execution failed: Code failed' }
    mockExecuteTool.mockResolvedValue(errorResult)

    await expect(handler.execute(mockBlock, inputs, mockContext)).rejects.toThrow(
      'Function execution failed: Code failed'
    )
    expect(mockExecuteTool).toHaveBeenCalled()
  })

  it('should handle tool error with no specific message', async () => {
    const inputs = { code: 'some code' }
    const errorResult = { success: false }
    mockExecuteTool.mockResolvedValue(errorResult)

    await expect(handler.execute(mockBlock, inputs, mockContext)).rejects.toThrow(
      'Function execution failed'
    )
  })
})
