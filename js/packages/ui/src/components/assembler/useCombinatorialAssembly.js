import React from 'react'
import { arrayCombinations, getNextCategories, isAssemblyComplete } from './assembler_utils'
import { getOverhangOrder } from './syntax_layout'

// The categories chosen at each position of the assembly (undefined if a category no longer exists)
function getChosenCategories(assembly, categories) {
  return assembly.map((item) => categories.find((category) => category.id === item.category))
}

export default function useCombinatorialAssembly( { onValueChange, categories, plasmids }) {

  const [assembly, setAssembly] = React.useState([])
  const overhangOrder = React.useMemo(() => getOverhangOrder(categories), [categories])

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

  // The categories that can be chosen at a position of the assembly, given the ones chosen before it
  const getAllowedCategories = React.useCallback((index) => (
    getNextCategories(categories, getChosenCategories(assembly.slice(0, index), categories), overhangOrder)
  ), [assembly, categories, overhangOrder])

  // If the next category of the assembly can only be one, add it to the assembly
  React.useEffect(() => {
    const newAssembly = [...assembly]
    while (true) {
      const chosenCategories = getChosenCategories(newAssembly, categories)
      if (isAssemblyComplete(chosenCategories)) {
        break
      }
      const nextCategories = getNextCategories(categories, chosenCategories, overhangOrder)
      if (nextCategories.length !== 1) {
        break
      }
      newAssembly.push({ category: nextCategories[0].id, plasmidIds: [] })
    }
    if (newAssembly.length !== assembly.length) {
      setAssembly(newAssembly)
    }
  }, [assembly, categories, overhangOrder])

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
  const assemblyComplete = isAssemblyComplete(getChosenCategories(assembly, categories));
  const canBeSubmitted = assemblyComplete && assembly.every((item) => item.plasmidIds.length > 0)
  const currentCategories = React.useMemo(() => assembly.map((item) => item.category), [assembly])

  return React.useMemo(() => ({ assembly, setCategory, setId, getAllowedCategories, expandedAssemblies, assemblyComplete, canBeSubmitted, currentCategories }), [assembly, setCategory, setId, getAllowedCategories, expandedAssemblies, assemblyComplete, canBeSubmitted, currentCategories])
}
