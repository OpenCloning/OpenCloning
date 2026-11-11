import React from 'react'
import { arrayCombinations, categoryFilter } from './assembler_utils'

function isAssemblyComplete(assembly, categories) {
  const lastPosition = assembly.length - 1
  if (lastPosition === -1) {
    return false
  }
  const lastCategory = categories.find((category) => category.id === assembly[lastPosition].category)
  return lastCategory?.right_overhang === categories[0].left_overhang
}


export default function useCombinatorialAssembly( { onValueChange, categories, plasmids }) {

  const [assembly, setAssembly] = React.useState([])

  const setCategory = React.useCallback((category, index) => {
    onValueChange()
    if (category === '') {
      setAssembly(prev => prev.slice(0, index))
    } else {
      setAssembly(prev => [...prev.slice(0, index), { category, plasmidIds: [] }])
    }
  }, [onValueChange])

  const setId = React.useCallback((plasmidIds, index) => {
    onValueChange()
    // Handle case where user clears all selections (empty array)
    const value = (!plasmidIds || plasmidIds.length === 0) ? [] : plasmidIds
    setAssembly( prev => prev.map((item, i) => i === index ? { ...item, plasmidIds: value } : item))
  }, [onValueChange])

  // If the next category of the assembly can only be one, add it to the assembly
  React.useEffect(() => {
    const newAssembly = [...assembly]
    while (true) {
      if (isAssemblyComplete(newAssembly, categories)) {
        break
      }
      let lastPosition = newAssembly.length - 1
      const previousCategoryId = lastPosition === -1 ? null : newAssembly[lastPosition].category
      let nextCategories = categories.filter((category) => categoryFilter(category, categories, previousCategoryId))
      if (nextCategories.length !== 1) {
        break
      } else if (nextCategories.length === 1) {
        newAssembly.push({ category: nextCategories[0].id, plasmidIds: [] })
      }
    }
    if (newAssembly.length !== assembly.length) {
      setAssembly(newAssembly)
    }
  }, [assembly, categories])

  // If plasmids are removed, remove them from the assembly
  React.useEffect(() => {
    onValueChange()
    setAssembly(prev => {
      const existingPlasmidIds = plasmids.map((plasmid) => plasmid.id)
      return prev.map((item) => ({ ...item, plasmidIds: item.plasmidIds.filter((id) => existingPlasmidIds.includes(id)) }))
    }
    )
  }, [plasmids, onValueChange])

  // If categories are changed, clear the assembly
  React.useEffect(() => {
    setAssembly([])
  }, [categories])

  const expandedAssemblies = React.useMemo(() => arrayCombinations(assembly.map(({ plasmidIds }) => plasmidIds)), [assembly])
  const assemblyComplete = isAssemblyComplete(assembly, categories);
  const canBeSubmitted = assemblyComplete && assembly.every((item) => item.plasmidIds.length > 0)
  const currentCategories = React.useMemo(() => assembly.map((item) => item.category), [assembly])

  return React.useMemo(() => ({ assembly, setCategory, setId, expandedAssemblies, assemblyComplete, canBeSubmitted, currentCategories }), [assembly, setCategory, setId, expandedAssemblies, assemblyComplete, canBeSubmitted, currentCategories])
}
