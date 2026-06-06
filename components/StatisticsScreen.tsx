import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';

interface MedicationStats {
  total: number;
  taken: number;
  missed: number;
  pending: number;
}

interface ConnectedAccount {
  id: string;
  name: string;
  type: 'family' | 'caretaker' | 'patient';
}

interface Props {
  stats: MedicationStats;
  connectedAccounts: ConnectedAccount[];
  monthlyData?: { month: string; taken: number; missed: number }[];
}

const screenWidth = Dimensions.get('window').width;

export default function StatisticsScreen({ stats, connectedAccounts, monthlyData }: Props) {
  const pieData = [
    {
      name: 'Taken',
      population: stats.taken,
      color: theme.green,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Missed',
      population: stats.missed,
      color: theme.danger,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Pending',
      population: stats.pending,
      color: '#f5a623',
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
  ];

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(61, 143, 90, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(26, 31, 28, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: theme.green,
    },
  };

  const barData = {
    labels: monthlyData?.map(d => d.month.slice(0, 3)) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: monthlyData?.map(d => d.taken) || [12, 15, 10, 18, 14, 16],
      },
    ],
  };

  const missedBarData = {
    labels: monthlyData?.map(d => d.month.slice(0, 3)) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: monthlyData?.map(d => d.missed) || [2, 1, 3, 1, 2, 1],
      },
    ],
  };

  const complianceRate = stats.total > 0 
    ? Math.round((stats.taken / stats.total) * 100) 
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Medication Statistics</Text>

      {/* Overview Stats */}
      <View style={styles.overviewCard}>
        <Text style={styles.cardTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.green }]}>{stats.taken}</Text>
            <Text style={styles.statLabel}>Taken</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.danger }]}>{stats.missed}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f5a623' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
        <View style={styles.complianceBar}>
          <Text style={styles.complianceLabel}>Compliance Rate: {complianceRate}%</Text>
          <View style={styles.complianceTrack}>
            <View style={[styles.complianceFill, { width: `${complianceRate}%` }]} />
          </View>
        </View>
      </View>

      {/* Pie Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Distribution</Text>
        <PieChart
          data={pieData}
          width={screenWidth - 48}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>

      {/* Bar Chart - Taken */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Medications Taken (Monthly)</Text>
        <BarChart
          data={barData}
          width={screenWidth - 48}
          height={220}
          chartConfig={chartConfig}
          verticalLabelRotation={30}
        />
      </View>

      {/* Bar Chart - Missed */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Missed Doses (Monthly)</Text>
        <BarChart
          data={missedBarData}
          width={screenWidth - 48}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(181, 74, 74, ${opacity})`,
          }}
          verticalLabelRotation={30}
        />
      </View>

      {/* Connected Accounts */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Connected Accounts</Text>
        {connectedAccounts.length === 0 ? (
          <Text style={styles.emptyText}>No connected accounts</Text>
        ) : (
          connectedAccounts.map(account => (
            <View key={account.id} style={styles.accountRow}>
              <View style={styles.accountIcon}>
                <Text style={styles.accountIconText}>
                  {account.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountType}>{account.type}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: TEXT.xxl,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 16,
  },
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: TEXT.lg,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: TEXT.xxl,
    fontWeight: '800',
    color: theme.text,
  },
  statLabel: {
    fontSize: TEXT.sm,
    color: theme.textSecondary,
    marginTop: 4,
  },
  complianceBar: {
    marginTop: 8,
  },
  complianceLabel: {
    fontSize: TEXT.md,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  complianceTrack: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  complianceFill: {
    height: '100%',
    backgroundColor: theme.green,
    borderRadius: 4,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: TEXT.md,
    color: theme.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountIconText: {
    fontSize: TEXT.lg,
    fontWeight: '800',
    color: theme.green,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: TEXT.md,
    fontWeight: '700',
    color: theme.text,
  },
  accountType: {
    fontSize: TEXT.sm,
    color: theme.textSecondary,
    marginTop: 2,
  },
});
