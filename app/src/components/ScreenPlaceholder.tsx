import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  task: string;
};

/** Écran provisoire : sera remplacé par la tâche indiquée du plan technique. */
export function ScreenPlaceholder({ title, task }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.task}>À venir : tâche {task}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  task: {
    marginTop: 8,
    color: '#555',
  },
});
