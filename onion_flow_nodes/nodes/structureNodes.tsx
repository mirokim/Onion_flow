/**
 * Structure node plugins: group
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'

registerPlugin({
  definition: {
    type: 'group',
    label: 'Group',
    labelKo: '그룹',
    category: 'structure',
    tags: ['structure'],
    color: NODE_CATEGORY_COLORS.structure,
    inputs: [],
    outputs: [],
    defaultData: { label: 'Group' },
  },
  // No bodyComponent, extractData, buildPromptSegment, or execute — group is a visual container only
})
